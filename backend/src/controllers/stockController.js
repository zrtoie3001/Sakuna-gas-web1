const { GasStock, GasStockLog, GasRefill, Equipment, EquipmentSale } = require("../models");
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
  const { brandName, weightKg, qty, costPerUnit, note } = req.body;
  const totalCost = (Number(costPerUnit) || 0) * Number(qty);
  const refill = await GasRefill.create({ brandName, weightKg, qty, costPerUnit, totalCost, note });

  let stock = await GasStock.findOne({ where: { brandName, weightKg } });
  if (!stock) stock = await GasStock.create({ brandName, weightKg });
  const oldVal = Number(stock.hasGas);
  const newVal = oldVal + Number(qty);
  await stock.update({ hasGas: newVal });
  await writeLog(brandName, weightKg, "hasGas", oldVal, newVal, "refill", note);
  appendStockLog({ brandName, weightKg, field: "hasGas", oldValue: oldVal, newValue: newVal, delta: Number(qty), action: "refill", note }).catch(() => {});
  syncStockToSheet().catch(() => {});
  res.status(201).json(refill);
}

// ── Equipment ─────────────────────────────────────────────────────────────────

async function getEquipment(_req, res) {
  const rows = await Equipment.findAll({ where: { isActive: true }, order: [["name", "ASC"]] });
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

module.exports = { getGasStock, upsertGasStock, adjustGasStock, getStockLogs, getRefills, addRefill, getEquipment, createEquipment, updateEquipment, deleteEquipment, sellEquipment };
