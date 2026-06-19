const { DiscountCode } = require("../models");

async function listCodes(_req, res) {
  const codes = await DiscountCode.findAll({ order: [["createdAt", "DESC"]] });
  res.json(codes);
}

async function createCode(req, res) {
  const code = await DiscountCode.create({
    ...req.body,
    code: req.body.code.toUpperCase(),
  });
  res.status(201).json(code);
}

async function updateCode(req, res) {
  const code = await DiscountCode.findByPk(req.params.id);
  if (!code) return res.status(404).json({ error: "Not found" });
  await code.update(req.body);
  res.json(code);
}

async function deleteCode(req, res) {
  const code = await DiscountCode.findByPk(req.params.id);
  if (!code) return res.status(404).json({ error: "Not found" });
  await code.destroy();
  res.json({ message: "Deleted" });
}

async function validateCode(req, res) {
  const { code, subtotal, zone } = req.body;
  const dc = await DiscountCode.findOne({ where: { code: code.toUpperCase(), isActive: true } });
  if (!dc) return res.status(400).json({ error: "โค้ดไม่ถูกต้อง" });
  if (dc.expiresAt && new Date() > dc.expiresAt) return res.status(400).json({ error: "โค้ดหมดอายุแล้ว" });
  if (dc.maxUses && dc.usedCount >= dc.maxUses) return res.status(400).json({ error: "โค้ดถูกใช้ครบแล้ว" });
  if (subtotal < Number(dc.minOrderAmount)) return res.status(400).json({ error: `ยอดขั้นต่ำ ฿${dc.minOrderAmount}` });
  const discount = dc.type === "percent"
    ? Math.round(subtotal * dc.value / 100)
    : Math.min(Number(dc.value), subtotal);

  res.json({ valid: true, discount, description: dc.description });
}

module.exports = { listCodes, createCode, updateCode, deleteCode, validateCode };
