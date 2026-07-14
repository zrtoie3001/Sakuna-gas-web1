const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { createOrder, getOrderById, listOrders, updateStatus, acceptOrder, createWalkinOrder } = require("../controllers/orderController");
const { notifyAdminPaymentConfirmed, sendPaymentReceivedToCustomer } = require("../services/lineService");
const { Order, Brand, Product, Customer } = require("../models");
const { requireAuth, requireRole } = require("../middleware/auth");

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads",
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Image only"), ok);
  },
});

// Walk-in sale (admin)
router.post("/walkin", requireAuth, createWalkinOrder);

// Customer (no auth — identified by lineUserId in body)
router.post("/", createOrder);
router.get("/:id", getOrderById);

// Upload slip (customer)
router.post("/:id/slip", upload.single("slip"), async (req, res) => {
  const { Order } = require("../models");
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update({ slipUrl: `/uploads/${req.file.filename}` });
  res.json({ slipUrl: order.slipUrl });
});

// Customer confirms QR payment — notify admin via LINE
router.post("/:id/payment-confirmed", async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: Brand, as: "brand" },
        { model: Product, as: "product" },
        { model: Customer, as: "customer" },
      ],
    });
    if (!order) return res.status(404).json({ error: "Not found" });
    // Notify admin
    notifyAdminPaymentConfirmed(order).catch(() => {});
    // Send confirmation back to customer's LINE chat
    if (order.customer?.lineUserId) {
      sendPaymentReceivedToCustomer(order.customer.lineUserId, order).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer name suggestions from order history (for autocomplete)
router.get("/customer-suggestions", requireAuth, async (req, res) => {
  try {
    const { q = "" } = req.query;
    const { sequelize } = require("../config/database");
    const { Op } = require("sequelize");
    const where = q ? {
      [Op.or]: [
        { customerName: { [Op.iLike]: `%${q}%` } },
        { customerPhone: { [Op.iLike]: `%${q}%` } },
      ],
    } : {};
    // Distinct customer_name + customer_phone combos from orders
    const rows = await Order.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("customer_name")), "customerName"],
        "customerPhone", "deliveryAddress",
      ],
      where: { ...where, customerName: { [Op.ne]: null } },
      order: [["createdAt", "DESC"]],
      limit: 50,
      raw: true,
    });
    // Deduplicate by name
    const seen = new Set();
    const result = [];
    for (const r of rows) {
      const key = (r.customerName || "").toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push(r); }
      if (result.length >= 10) break;
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Staff
router.get("/", requireAuth, listOrders);
router.put("/:id/status", requireAuth, updateStatus);
router.put("/:id/payment", requireAuth, async (req, res) => {
  const { Order } = require("../models");
  const { paymentMethod } = req.body;
  if (!["cash","qr","cod"].includes(paymentMethod)) return res.status(400).json({ error: "Invalid payment method" });
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update({ paymentMethod });
  res.json({ ok: true });
});
router.patch("/:id/paid", requireAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    await order.update({ isPaid: !order.isPaid });
    res.json({ isPaid: order.isPaid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/:id/accept", requireAuth, requireRole("driver", "admin"), acceptOrder);

module.exports = router;
