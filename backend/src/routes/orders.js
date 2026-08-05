const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { createOrder, getOrderById, listOrders, updateStatus, acceptOrder, createWalkinOrder, updateOrder } = require("../controllers/orderController");
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
    const ql = (q || "").trim();
    if (!ql) return res.json([]);

    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");

    // Raw SQL — search name/phone/address
    const rows = await seq.query(
      `SELECT customer_name, customer_phone, delivery_address, brand_id, product_id, unit_price, note
       FROM orders
       WHERE customer_name ILIKE :q
          OR customer_phone ILIKE :q
          OR delivery_address ILIKE :q
       ORDER BY created_at DESC
       LIMIT 300`,
      { replacements: { q: `%${ql}%` }, type: QueryTypes.SELECT }
    );

    // Fetch brand/product names
    const brandIds   = [...new Set(rows.map(r => r.brand_id).filter(Boolean))];
    const productIds = [...new Set(rows.map(r => r.product_id).filter(Boolean))];
    const brandMap   = new Map();
    const productMap = new Map();
    if (brandIds.length) {
      const bs = await Brand.findAll({ where: { id: brandIds }, attributes: ["id", "name"] });
      bs.forEach(b => brandMap.set(b.id, b.name));
    }
    if (productIds.length) {
      const ps = await Product.findAll({ where: { id: productIds }, attributes: ["id", "name"] });
      ps.forEach(p => productMap.set(p.id, { name: p.name }));
    }

    // Deduplicate by phone/name, collect all addresses
    const map = new Map();
    for (const r of rows) {
      const key = (r.customer_phone || r.customer_name || "").trim().toLowerCase();
      if (!key) continue;

      let walkin = null;
      if (r.note?.startsWith("__walkin:")) {
        try { walkin = JSON.parse(r.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
      }

      if (!map.has(key)) {
        const prod = r.product_id ? productMap.get(r.product_id) : null;
        map.set(key, {
          customerName:    r.customer_name,
          customerPhone:   r.customer_phone,
          deliveryAddress: r.delivery_address,
          addresses: [],
          addrSet:  new Set(),
          brandId:      r.brand_id   || null,
          productId:    r.product_id || null,
          brandName:    (r.brand_id ? brandMap.get(r.brand_id) : null) || walkin?.brandName || null,
          productName:  prod?.name || (walkin ? `${walkin.brandName} ${walkin.weightKg}กก.` : null),
          weightKg:     walkin?.weightKg || null,
          unitPrice:    r.unit_price ? Number(r.unit_price) : (walkin?.unitPrice ? Number(walkin.unitPrice) : null),
        });
      }
      const entry = map.get(key);
      if (r.delivery_address && !entry.addrSet.has(r.delivery_address)) {
        entry.addrSet.add(r.delivery_address);
        entry.addresses.push(r.delivery_address);
      }
      if (!entry.brandName && walkin?.brandName) entry.brandName = walkin.brandName;
      if (!entry.weightKg  && walkin?.weightKg)  entry.weightKg  = walkin.weightKg;
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
router.put("/:id", requireAuth, updateOrder);
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
    // Sync linked debt record
    try {
      const { Debt } = require("../models");
      const debt = await Debt.findOne({ where: { orderId: order.id } });
      if (debt) {
        if (order.isPaid) {
          await debt.update({ isPaid: true, paidAt: new Date() });
        } else {
          await debt.update({ isPaid: false, paidAt: null });
        }
      }
    } catch (e) { console.error("Debt sync error:", e.message); }
    res.json({ isPaid: order.isPaid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/:id/accept", requireAuth, requireRole("driver", "admin"), acceptOrder);

module.exports = router;
