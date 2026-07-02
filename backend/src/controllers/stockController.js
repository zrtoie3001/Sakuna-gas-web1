const { GasStock, GasRefill, Equipment, EquipmentSale } = require("../models");
const { syncStockToSheet } = require("../services/sheetsService");

const BRANDS = ["ปตท", "PAP", "เวิลด์", "สยาม", "ยูนิค"];
const WEIGHTS = [4, 7, 8, 11.5, 13.5, 15, 48];

// ── Gas Stock ─────────────────────────────────────────────────────────────────

async function getGasStock(_req, res) {
  const rows = await GasStock.findAll({ order: [["brandName", "ASC"], ["weightKg", "ASC"]] });
  res.json(rows);
}

async function upsertGasStock(req, res) {
  const { brandName, weightKg, hasGas, newTank, emptyTank, damagedTank, heldTank } = req.body;
  let row = await GasStock.findOne({ where: { brandName, weightKg } });
  if (row) {
    await row.update({ hasGas, newTank, emptyTank, damagedTank, heldTank });
  } else {
    row = await GasStock.create({ brandName, weightKg, hasGas, newTank, emptyTank, damagedTank, heldTank });
  }
  syncStockToSheet().catch(() => {});
  res.json(row);
}

async function adjustGasStock(req, res) {
  const { brandName, weightKg, field, delta } = req.body;
  let row = await GasStock.findOne({ where: { brandName, weightKg } });
  if (!row) row = await GasStock.create({ brandName, weightKg });
  const current = Number(row[field] || 0);
  await row.update({ [field]: Math.max(0, current + delta) });
  syncStockToSheet().catch(() => {});
  res.json(row);
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

  // เพิ่มสต็อก hasGas
  let stock = await GasStock.findOne({ where: { brandName, weightKg } });
  if (!stock) stock = await GasStock.create({ brandName, weightKg });
  await stock.update({ hasGas: Number(stock.hasGas) + Number(qty) });
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

module.exports = { getGasStock, upsertGasStock, adjustGasStock, getRefills, addRefill, getEquipment, createEquipment, updateEquipment, deleteEquipment, sellEquipment };
