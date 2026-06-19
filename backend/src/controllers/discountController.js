const { DiscountCode } = require("../models");

async function listCodes(_req, res) {
  const codes = await DiscountCode.findAll({ order: [["createdAt", "DESC"]] });
  res.json(codes);
}

async function createCode(req, res) {
  try {
    const body = { ...req.body, code: req.body.code.toUpperCase() };
    if (!body.expiresAt) body.expiresAt = null;
    const code = await DiscountCode.create(body);
    res.status(201).json(code);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function updateCode(req, res) {
  const code = await DiscountCode.findByPk(req.params.id);
  if (!code) return res.status(404).json({ error: "Not found" });
  await code.update(req.body);
  res.json(code);
}

async function deleteCode(req, res) {
  try {
    const code = await DiscountCode.findByPk(req.params.id);
    if (!code) return res.status(404).json({ error: "Not found" });
    // Deactivate instead of hard-delete if orders reference it
    const { Order } = require("../models");
    const linked = await Order.count({ where: { discountCodeId: req.params.id } });
    if (linked > 0) {
      await code.update({ isActive: false, code: `[ลบ]${code.code}` });
      return res.json({ message: "Deactivated (has linked orders)" });
    }
    await code.destroy();
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function validateCode(req, res) {
  // cart: [{ productId, subtotal }] — array of items in the cart
  // Falls back to single productId+subtotal for backwards compat
  const { code, cart, subtotal: singleSubtotal, productId: singleProductId } = req.body;
  const dc = await DiscountCode.findOne({ where: { code: code.toUpperCase(), isActive: true } });
  if (!dc) return res.status(400).json({ error: "โค้ดไม่ถูกต้อง" });
  if (dc.expiresAt && new Date() > dc.expiresAt) return res.status(400).json({ error: "โค้ดหมดอายุแล้ว" });
  if (dc.maxUses && dc.usedCount >= dc.maxUses) return res.status(400).json({ error: "โค้ดถูกใช้ครบแล้ว" });

  // Determine which cart items are eligible
  let eligibleSubtotal;
  let applicableProductIds; // product IDs the discount will actually apply to
  if (Array.isArray(cart) && cart.length > 0) {
    const eligible = dc.allowedProducts?.length
      ? cart.filter(i => dc.allowedProducts.includes(i.productId))
      : cart;
    if (eligible.length === 0)
      return res.status(400).json({ error: "โค้ดนี้ใช้ได้เฉพาะบางสินค้าที่ไม่มีในตะกร้า" });
    eligibleSubtotal = eligible.reduce((s, i) => s + Number(i.subtotal), 0);
    applicableProductIds = eligible.map(i => i.productId);
  } else {
    // single-item fallback
    if (dc.allowedProducts?.length && singleProductId && !dc.allowedProducts.includes(singleProductId))
      return res.status(400).json({ error: "โค้ดนี้ใช้ได้เฉพาะบางสินค้าเท่านั้น" });
    eligibleSubtotal = Number(singleSubtotal);
    applicableProductIds = singleProductId ? [singleProductId] : [];
  }

  if (eligibleSubtotal < Number(dc.minOrderAmount))
    return res.status(400).json({ error: `ยอดขั้นต่ำ ฿${dc.minOrderAmount}` });

  const discount = dc.type === "percent"
    ? Math.round(eligibleSubtotal * dc.value / 100)
    : Math.min(Number(dc.value), eligibleSubtotal);

  res.json({ valid: true, discount, applicableProductIds, description: dc.description });
}

module.exports = { listCodes, createCode, updateCode, deleteCode, validateCode };
