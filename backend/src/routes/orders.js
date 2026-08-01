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
    const { sequelize: seq } = require("../config/database");
    const ql = (q || "").trim();
    if (!ql) return res.json([]);

    // Use raw SQL to avoid underscored/iLike issues — search name, phone, address
    const [rows] = await seq.query(`
      SELECT DISTINCT ON (COALESCE(customer_phone, customer_name))
        customer_name   AS "customerName",
        customer_phone  AS "customerPhone",
        delivery_address AS "deliveryAddress",
        brand_id        AS "brandId",
        product_id      AS "productId",
        note
      FROM orders
      WHERE
        customer_name    ILIKE :q
        OR customer_phone ILIKE :q
        OR delivery_address ILIKE :q
      ORDER BY COALESCE(customer_phone, customer_name), created_at DESC
      LIMIT 300
    `, { replacements: { q: `%${ql}%` }, type: seq.QueryTypes.SELECT });

    // Fetch brand/product names in one go
    const brandIds   = [...new Set(rows.map(r => r.brandId).filter(Boolean))];
    const productIds = [...new Set(rows.map(r => r.productId).filter(Boolean))];

    const brandMap   = new Map();
    const productMap = new Map();
    if (brandIds.length) {
      const bs = await Brand.findAll({ where: { id: brandIds }, attributes: ["id", "name"] });
      bs.forEach(b => brandMap.set(b.id, b.name));
    }
    if (productIds.length) {
      const ps = await Product.findAll({ where: { id: productIds }, attributes: ["id", "name", "price"] });
      ps.forEach(p => productMap.set(p.id, { name: p.name, price: p.price }));
    }

    // Group by phone/name to collect all addresses
    const map = new Map();
    for (const r of rows) {
      const key = (r.customerPhone || r.customerName || "").trim().toLowerCase();
      if (!key) continue;

      let walkin = null;
      if (r.note?.startsWith("__walkin:")) {
        try { walkin = JSON.parse(r.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
      }

      if (!map.has(key)) {
        const prod = r.productId ? productMap.get(r.productId) : null;
        map.set(key, {
          customerName:   r.customerName,
          customerPhone:  r.customerPhone,
          deliveryAddress: r.deliveryAddress,
          addresses: [],
          addrSet: new Set(),
          brandId:      r.brandId   || null,
          productId:    r.productId || null,
          brandName:    (r.brandId ? brandMap.get(r.brandId) : null) || walkin?.brandName || null,
          productName:  prod?.name || (walkin ? `${walkin.brandName} ${walkin.weightKg}กก.` : null),
          productPrice: prod?.price || null,
          weightKg:     walkin?.weightKg || null,
        });
      }
      const entry = map.get(key);
      if (r.deliveryAddress && !entry.addrSet.has(r.deliveryAddress)) {
        entry.addrSet.add(r.deliveryAddress);
        entry.addresses.push(r.deliveryAddress);
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
