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
  const { code, subtotal, productId } = req.body;
  const dc = await DiscountCode.findOne({ where: { code: code.toUpperCase(), isActive: true } });
  if (!dc) return res.status(400).json({ error: "โค้ดไม่ถูกต้อง" });
  if (dc.expiresAt && new Date() > dc.expiresAt) return res.status(400).json({ error: "โค้ดหมดอายุแล้ว" });
  if (dc.maxUses && dc.usedCount >= dc.maxUses) return res.status(400).json({ error: "โค้ดถูกใช้ครบแล้ว" });
  if (subtotal < Number(dc.minOrderAmount)) return res.status(400).json({ error: `ยอดขั้นต่ำ ฿${dc.minOrderAmount}` });
  if (dc.allowedProducts?.length && productId && !dc.allowedProducts.includes(productId))
    return res.status(400).json({ error: "โค้ดนี้ใช้ได้เฉพาะบางสินค้าเท่านั้น" });
  const discount = dc.type === "percent"
    ? Math.round(subtotal * dc.value / 100)
    : Math.min(Number(dc.value), subtotal);

  res.json({ valid: true, discount, description: dc.description });
}

module.exports = { listCodes, createCode, updateCode, deleteCode, validateCode };
