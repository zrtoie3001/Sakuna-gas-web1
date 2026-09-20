const { GasStock, GasStockLog, GasRefill, Equipment, EquipmentSale } = require("../models");
const { Op } = require("sequelize");

const SHARED_BRANDS = ["สยาม", "ยูนิค"];
const SHARED_GROUP_NAME = "ยูนิค/สยาม";
const SHARED_PRIMARY = "ยูนิค"; // brand ที่เก็บสต็อกหลักเมื่อเติมแบบ shared

function resolveSharedBrand(brandName) {
  // "ยูนิค/สยาม" → ยูนิค (primary), "สยาม" หรือ "ยูนิค" → ตัวเอง
  if (brandName === SHARED_GROUP_NAME) return SHARED_PRIMARY;
  return brandName;
}
function isSharedBrand(brandName) {
  return SHARED_BRANDS.includes(brandName) || brandName === SHARED_GROUP_NAME;
}

// หักถังเปล่าจาก shared pool (ยูนิค+สยาม) หรือยี่ห้อเดี่ยว
async function deductEmptyTank(brandName, weightKg, qty) {
  const wkg = Number(weightKg);
  if (isSharedBrand(brandName)) {
    const stocks = await GasStock.findAll({ where: { brandName: { [Op.in]: SHARED_BRANDS }, weightKg: wkg }, order: [["emptyTank", "DESC"]] });
    let remaining = qty;
    for (const s of stocks) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(s.emptyTank || 0));
      if (take > 0) { await s.update({ emptyTank: Number(s.emptyTank) - take }); remaining -= take; }
    }
    // ถ้าถังเปล่ารวมไม่พอ ให้ set เป็น 0 (ไม่ error)
  } else {
    const stock = await GasStock.findOne({ where: { brandName, weightKg: wkg } });
    if (!stock) return;
    await stock.update({ emptyTank: Math.max(0, Number(stock.emptyTank || 0) - qty) });
  }
}

// คืนถังเปล่าให้ primary brand เมื่อลบรายการเติม
async function restoreEmptyTank(brandName, weightKg, qty) {
  const wkg = Number(weightKg);
  const target = resolveSharedBrand(brandName);
  const stock = await GasStock.findOne({ where: { brandName: target, weightKg: wkg } });
  if (stock) await stock.update({ emptyTank: Number(stock.emptyTank || 0) + qty });
}
const { syncStockToSheet, appendStockLog } = require("../services/sheetsService");

const STOCK_FIELDS = ["hasGas", "newTank", "emptyTank", "damagedTank", "heldTank"];

async function writeLog(brandName, weightKg, field, oldValue, newValue, action, note = "") {
  await GasStockLog.create({
    brandName, weightKg, field,
    oldValue: Number(oldValue || 0),
    newValue: Number(newValue || 0),
    delta: Number(newValue || 0) - Number(oldValue || 0),
    action, note,
  });
}

// ── Gas Stock ─────────────────────────────────────────────────────────────────

async function getGasStock(_req, res) {
  const rows = await GasStock.findAll({ order: [["brandName", "ASC"], ["weightKg", "ASC"]] });
  res.json(rows);
}

async function upsertGasStock(req, res) {
  const { brandName, weightKg, hasGas, newTank, emptyTank, damagedTank, heldTank } = req.body;
  let row = await GasStock.findOne({ where: { brandName, weightKg } });
  const prev = row ? { ...row.dataValues } : {};
  const next = { hasGas, newTank, emptyTank, damagedTank, heldTank };
  if (row) {
    await row.update(next);
  } else {
    row = await GasStock.create({ brandName, weightKg, ...next });
  }
  // log each changed field
  for (const f of STOCK_FIELDS) {
    const o = Number(prev[f] || 0), n = Number(next[f] || 0);
    if (o !== n) await writeLog(brandName, weightKg, f, o, n, "manual");
  }
  syncStockToSheet().catch(() => {});
  res.json(row);
}

async function adjustGasStock(req, res) {
  const { brandName, weightKg, field, delta } = req.body;
  let row = await GasStock.findOne({ where: { brandName, weightKg } });
  if (!row) row = await GasStock.create({ brandName, weightKg });
  const oldVal = Number(row[field] || 0);
  const newVal = Math.max(0, oldVal + delta);
  await row.update({ [field]: newVal });
  await writeLog(brandName, weightKg, field, oldVal, newVal, "adjust");
  appendStockLog({ brandName, weightKg, field, oldValue: oldVal, newValue: newVal, delta, action: "adjust" }).catch(() => {});
  syncStockToSheet().catch(() => {});
  res.json(row);
}

async function getStockLogs(req, res) {
  const { brandName, weightKg, limit = 200 } = req.query;
  const where = {};
  if (brandName) where.brandName = brandName;
  if (weightKg) where.weightKg = weightKg;
  const logs = await GasStockLog.findAll({ where, order: [["createdAt", "DESC"]], limit: parseInt(limit) });
  res.json(logs);
}

// ── Gas Refill ────────────────────────────────────────────────────────────────

async function getRefills(_req, res) {
  const rows = await GasRefill.findAll({ order: [["createdAt", "DESC"]], limit: 100 });
  res.json(rows);
}

async function addRefill(req, res) {
  const { weightKg, qty, note } = req.body;
  const brandName = req.body.brandName; // อาจเป็น "ยูนิค/สยาม"
  const resolvedBrand = resolveSharedBrand(brandName); // เก็บในสต็อก primary brand
  const costPerUnit = req.body.costPerUnit !== "" && req.body.costPerUnit != null ? Number(req.body.costPerUnit) : null;
  const totalCost = (costPerUnit || 0) * Number(qty);
  const refill = await GasRefill.create({ brandName: resolvedBrand, weightKg, qty, costPerUnit, totalCost, note });

  let stock = await GasStock.findOne({ where: { brandName: resolvedBrand, weightKg } });
  if (!stock) stock = await GasStock.create({ brandName: resolvedBrand, weightKg });
  const oldHas = Number(stock.hasGas);
  const newHas = oldHas + Number(qty);
  await stock.update({ hasGas: newHas });
  await deductEmptyTank(resolvedBrand, weightKg, Number(qty));
  await writeLog(resolvedBrand, weightKg, "hasGas", oldHas, newHas, "refill", note);
  appendStockLog({ brandName: resolvedBrand, weightKg, field: "hasGas", oldValue: oldHas, newValue: newHas, delta: Number(qty), action: "refill", note }).catch(() => {});
  syncStockToSheet().catch(() => {});
  res.status(201).json(refill);
}

async function deleteRefill(req, res) {
  try {
    const refill = await GasRefill.findByPk(req.params.id);
    if (!refill) return res.status(404).json({ error: "Not found" });
    // Reverse the stock addition
    const stock = await GasStock.findOne({ where: { brandName: refill.brandName, weightKg: refill.weightKg } });
    if (stock) {
      const oldHas = Number(stock.hasGas);
      const newHas = Math.max(0, oldHas - Number(refill.qty));
      await stock.update({ hasGas: newHas });
      await restoreEmptyTank(refill.brandName, refill.weightKg, Number(refill.qty));
      await writeLog(refill.brandName, refill.weightKg, "hasGas", oldHas, newHas, "refill-delete", `ลบรายการเติม ${refill.qty} ถัง`);
    }
    await refill.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Equipment ─────────────────────────────────────────────────────────────────

async function getEquipment(req, res) {
  const where = { isActive: true };
  if (req.query.category) where.category = req.query.category;
  const rows = await Equipment.findAll({ where, order: [["name", "ASC"]] });
  res.json(rows);
}

async function createEquipment(req, res) {
  const item = await Equipment.create(req.body);
  res.status(201).json(item);
}

async function updateEquipment(req, res) {
  const item = await Equipment.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  await item.update(req.body);
  res.json(item);
}

async function deleteEquipment(req, res) {
  const item = await Equipment.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  await item.update({ isActive: false });
  res.json({ ok: true });
}

async function sellEquipment(req, res) {
  const { qty, salePrice, note } = req.body;
  const item = await Equipment.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  if (item.qty < qty) return res.status(400).json({ error: "สต็อกไม่พอ" });
  await item.update({ qty: item.qty - qty });
  const sale = await EquipmentSale.create({ equipmentId: item.id, qty, salePrice, note });
  res.status(201).json(sale);
}

async function updateNewTankPrice(req, res) {
  const { brandName, weightKg, price } = req.body;
  let row = await GasStock.findOne({ where: { brandName, weightKg } });
  if (!row) row = await GasStock.create({ brandName, weightKg });
  await row.update({ newTankPrice: price === "" || price == null ? null : Number(price) });
  res.json(row);
}

module.exports = { getGasStock, upsertGasStock, adjustGasStock, getStockLogs, getRefills, addRefill, deleteRefill, getEquipment, createEquipment, updateEquipment, deleteEquipment, sellEquipment, updateNewTankPrice };
