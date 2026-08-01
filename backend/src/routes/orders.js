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

// Customer suggestions — search by name OR phone, returns gas info + all addresses
router.get("/customer-suggestions", requireAuth, async (req, res) => {
  try {
    const { q = "" } = req.query;
    const { Op } = require("sequelize");
    const where = q ? {
      [Op.or]: [
        { customerName: { [Op.iLike]: `%${q}%` } },
        { customerPhone: { [Op.iLike]: `%${q}%` } },
      ],
    } : {};
    const rows = await Order.findAll({
      attributes: ["customerName", "customerPhone", "deliveryAddress", "brandId", "productId", "note"],
      include: [
        { model: Brand,   as: "brand",   attributes: ["id", "name"], required: false },
        { model: Product, as: "product", attributes: ["id", "name", "price"], required: false },
      ],
      where: { ...where, customerName: { [Op.ne]: null } },
      order: [["createdAt", "DESC"]],
      limit: 300,
    });

    // Group by phone (preferred) or name, collect all addresses + keep most-recent gas info
    const map = new Map();
    for (const r of rows) {
      const key = (r.customerPhone || r.customerName || "").trim().toLowerCase();
      if (!key) continue;

      // Parse walkin note for gas info
      let walkin = null;
      if (r.note?.startsWith("__walkin:")) {
        try { walkin = JSON.parse(r.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
      }

      if (!map.has(key)) {
        map.set(key, {
          customerName:  r.customerName,
          customerPhone: r.customerPhone,
          deliveryAddress: r.deliveryAddress,
          addresses: [],
          addrSet: new Set(),
          brandId:     r.brandId   || null,
          productId:   r.productId || null,
          brandName:   r.brand?.name   || walkin?.brandName || null,
          productName: r.product?.name || (walkin ? `${walkin.brandName} ${walkin.weightKg}กก.` : null),
          productPrice: r.product?.price || null,
          weightKg:    walkin?.weightKg || null,
        });
      }
      const entry = map.get(key);
      if (r.deliveryAddress && !entry.addrSet.has(r.deliveryAddress)) {
        entry.addrSet.add(r.deliveryAddress);
        entry.addresses.push(r.deliveryAddress);
      }
      // Fill gas info from most recent order that has it
      if (!entry.brandId && r.brandId) {
        entry.brandId = r.brandId;
        entry.productId = r.productId;
        entry.brandName = r.brand?.name;
        entry.productName = r.product?.name;
        entry.productPrice = r.product?.price;
      }
      if (!entry.weightKg && walkin?.weightKg) {
        entry.weightKg = walkin.weightKg;
        entry.brandName = entry.brandName || walkin.brandName;
      }
    }

    const result = [];
    for (const [, v] of map) {
      delete v.addrSet;
      result.push(v);
      if (result.length >= 10) break;
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Staff list
router.get("/", requireAuth, listOrders);

// Customer (no auth)
router.post("/", createOrder);
router.get("/:id", getOrderById);

// Upload slip (customer)
router.post("/:id/slip", upload.single("slip"), async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update({ slipUrl: `/uploads/${req.file.filename}` });
  res.json({ slipUrl: order.slipUrl });
});

// Customer confirms QR payment
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
    notifyAdminPaymentConfirmed(order).catch(() => {});
    if (order.customer?.lineUserId) {
      sendPaymentReceivedToCustomer(order.customer.lineUserId, order).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Staff actions
router.put("/:id/status", requireAuth, updateStatus);
router.put("/:id/payment", requireAuth, async (req, res) => {
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
