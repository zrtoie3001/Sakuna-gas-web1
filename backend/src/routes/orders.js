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

    // Raw SQL — search name/phone/address, exclude cancelled
    const rows = await seq.query(
      `SELECT customer_name, customer_phone, delivery_address, brand_id, product_id, unit_price, note
       FROM orders
       WHERE status != 'cancelled'
         AND (customer_name ILIKE :q
          OR customer_phone ILIKE :q
          OR delivery_address ILIKE :q)
       ORDER BY created_at DESC
       LIMIT 300`,
      { replacements: { q: `%${ql}%` }, type: QueryTypes.SELECT }
    );

    // Fetch brand/product names (including kg for weightKg)
    const brandIds   = [...new Set(rows.map(r => r.brand_id).filter(Boolean))];
    const productIds = [...new Set(rows.map(r => r.product_id).filter(Boolean))];
    const brandMap   = new Map();
    const productMap = new Map();
    if (brandIds.length) {
      const bs = await Brand.findAll({ where: { id: brandIds }, attributes: ["id", "name"] });
      bs.forEach(b => brandMap.set(b.id, b.name));
    }
    if (productIds.length) {
      const ps = await Product.findAll({ where: { id: productIds }, attributes: ["id", "name", "kg"] });
      ps.forEach(p => productMap.set(p.id, { name: p.name, kg: p.kg }));
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
        const isMixed = walkin?.type === "mixed";
        const bName = (r.brand_id ? brandMap.get(r.brand_id) : null) || (!isMixed ? walkin?.brandName : null) || null;
        const wKg   = prod?.kg != null ? Number(prod.kg) : (!isMixed ? (walkin?.weightKg ?? null) : null);
        let pName = prod?.name || null;
        if (!pName && walkin) {
          if (isMixed) pName = (walkin.items || []).map(i => i.brandName || i.name).filter(Boolean).join(", ") || "หลายรายการ";
          else if (walkin.brandName && walkin.weightKg) pName = `${walkin.brandName} ${walkin.weightKg}กก.`;
        }
        map.set(key, {
          customerName:    r.customer_name,
          customerPhone:   r.customer_phone,
          deliveryAddress: r.delivery_address,
          addresses: [],
          addrSet:  new Set(),
          brandId:      r.brand_id   || null,
          productId:    r.product_id || null,
          brandName:    bName,
          productName:  pName,
          weightKg:     wKg,
          unitPrice:    r.unit_price ? Number(r.unit_price) : (!isMixed && walkin?.unitPrice ? Number(walkin.unitPrice) : null),
        });
      }
      const entry = map.get(key);
      if (r.delivery_address && !entry.addrSet.has(r.delivery_address)) {
        entry.addrSet.add(r.delivery_address);
        entry.addresses.push(r.delivery_address);
      }
      if (!entry.brandName && walkin?.brandName && walkin?.type !== "mixed") entry.brandName = walkin.brandName;
      if (!entry.weightKg  && walkin?.weightKg  && walkin?.type !== "mixed") entry.weightKg  = walkin.weightKg;
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

// Customer order history (for quick re-order)
router.get("/customer-history", requireAuth, async (req, res) => {
  try {
    const { phone, name } = req.query;
    if (!phone && !name) return res.json([]);
    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");

    let whereSql, replacements;
    if (phone && name) {
      whereSql = `(customer_phone = :phone OR customer_name ILIKE :name)`;
      replacements = { phone, name };
    } else if (phone) {
      whereSql = `customer_phone = :phone`;
      replacements = { phone };
    } else {
      whereSql = `customer_name ILIKE :name`;
      replacements = { name };
    }
    const rows = await seq.query(
      `SELECT note, unit_price, brand_id, product_id, qty FROM orders
       WHERE status != 'cancelled' AND (${whereSql})
       ORDER BY created_at DESC LIMIT 200`,
      { replacements, type: QueryTypes.SELECT }
    );

    const brandIds   = [...new Set(rows.map(r => r.brand_id).filter(Boolean))];
    const productIds = [...new Set(rows.map(r => r.product_id).filter(Boolean))];
    const brandMap   = new Map();
    const productMap = new Map();
    if (brandIds.length) {
      const bs = await Brand.findAll({ where: { id: brandIds }, attributes: ["id", "name"] });
      bs.forEach(b => brandMap.set(b.id, b.name));
    }
    if (productIds.length) {
      const ps = await Product.findAll({ where: { id: productIds }, attributes: ["id", "name", "kg"] });
      ps.forEach(p => productMap.set(p.id, { name: p.name, kg: p.kg }));
    }

    // Collect all individual items
    const itemMap = new Map();
    const key = (type, brandName, weightKg, unitPrice) =>
      `${type}|${brandName}|${weightKg}|${unitPrice}`;

    for (const r of rows) {
      let walkin = null;
      if (r.note?.startsWith("__walkin:")) {
        try { walkin = JSON.parse(r.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
      }

      if (walkin?.type === "mixed" && Array.isArray(walkin.items)) {
        for (const it of walkin.items) {
          if (!it.brandName || !it.weightKg) continue;
          const k = key(it.type || "gas", it.brandName, it.weightKg, it.price || it.unitPrice);
          const entry = itemMap.get(k);
          if (entry) { entry.count++; }
          else itemMap.set(k, { type: it.type || "gas", brandName: it.brandName, weightKg: Number(it.weightKg), unitPrice: Number(it.price || it.unitPrice || 0), count: 1 });
        }
      } else if (walkin && walkin.brandName && walkin.weightKg) {
        const k = key(walkin.type || "gas", walkin.brandName, walkin.weightKg, walkin.unitPrice || r.unit_price);
        const entry = itemMap.get(k);
        if (entry) { entry.count++; }
        else itemMap.set(k, { type: walkin.type || "gas", brandName: walkin.brandName, weightKg: Number(walkin.weightKg), unitPrice: Number(walkin.unitPrice || r.unit_price || 0), count: 1 });
      } else if (r.brand_id) {
        const bName = brandMap.get(r.brand_id);
        const prod  = r.product_id ? productMap.get(r.product_id) : null;
        if (!bName) continue;
        const k = key("gas", bName, prod?.kg, r.unit_price);
        const entry = itemMap.get(k);
        if (entry) { entry.count++; }
        else itemMap.set(k, { type: "gas", brandName: bName, weightKg: prod?.kg != null ? Number(prod.kg) : null, unitPrice: Number(r.unit_price || 0), count: 1 });
      }
    }

    // Sort by frequency desc, return top 10
    const result = [...itemMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);
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
router.post("/:id/extras", requireAuth, async (req, res) => {
  try {
    const { items } = req.body; // [{ equipId, name, qty, price }]
    if (!items?.length) return res.status(400).json({ error: "ไม่มีรายการ" });
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });

    const { Equipment, EquipmentSale } = require("../models");
    let addedTotal = 0;
    const savedItems = [];

    for (const it of items) {
      const q = Number(it.qty) || 1;
      const p = Number(it.price) || 0;
      const eq = await Equipment.findByPk(it.equipId);
      if (!eq) return res.status(400).json({ error: `ไม่พบสินค้า: ${it.name}` });
      if (eq.qty < q) return res.status(400).json({ error: `สต็อก ${eq.name} ไม่พอ (มี ${eq.qty} ชิ้น)` });
      await eq.update({ qty: eq.qty - q });
      await EquipmentSale.create({ equipmentId: eq.id, qty: q, salePrice: p, note: `ออเดอร์ ${order.orderNumber}` });
      addedTotal += p * q;
      savedItems.push({ equipId: it.equipId, name: eq.name, qty: q, price: p });
    }

    // Append extras into order note
    const existingNote = order.note || "";
    let baseNote = existingNote;
    let extraNote = "";
    const extraTag = "__extras:";
    const extraIdx = existingNote.indexOf(extraTag);
    if (extraIdx >= 0) {
      baseNote = existingNote.slice(0, extraIdx).trimEnd();
      try {
        const existing = JSON.parse(existingNote.slice(extraIdx + extraTag.length));
        savedItems.push(...existing);
      } catch {}
    }
    extraNote = `${extraTag}${JSON.stringify(savedItems)}`;
    const newNote = baseNote ? `${baseNote}\n${extraNote}` : extraNote;
    await order.update({ note: newNote, total: Number(order.total) + addedTotal });

    res.json({ ok: true, addedTotal, items: savedItems });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/:id/accept", requireAuth, requireRole("driver", "admin"), acceptOrder);

module.exports = router;
