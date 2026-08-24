const { Op, DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { uploadStream } = require("../utils/cloudinary");

// Lazy-init model (ไม่ต้องแก้ models/index.js)
let StaffPayment;
function getModel() {
  if (StaffPayment) return StaffPayment;
  StaffPayment = sequelize.define("StaffPayment", {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    staffName:     { type: DataTypes.STRING(100), allowNull: false },
    amount:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    type:          { type: DataTypes.STRING(30), defaultValue: "salary" },
    note:          { type: DataTypes.TEXT },
    slipUrl:       { type: DataTypes.TEXT },
    createdBy:     { type: DataTypes.UUID },
    createdByName: { type: DataTypes.STRING(100) },
  }, { tableName: "staff_payments", underscored: true });
  return StaffPayment;
}

async function listPayroll(req, res) {
  try {
    const M = getModel();
    const { from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (from || to) {
      where.createdAt = {};
      if (from) { const d = new Date(from); d.setHours(0,0,0,0); where.createdAt[Op.gte] = d; }
      if (to)   { const d = new Date(to);   d.setHours(23,59,59,999); where.createdAt[Op.lte] = d; }
    }
    const { rows, count } = await M.findAndCountAll({
      where, order: [["createdAt", "DESC"]],
      limit: parseInt(limit), offset: (page - 1) * parseInt(limit),
    });
    res.json({ payments: rows, total: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function createPayroll(req, res) {
  try {
    const M = getModel();
    const { staffName, amount, type, note } = req.body;
    if (!staffName) return res.status(400).json({ error: "กรุณาระบุชื่อพนักงาน" });
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "กรุณาระบุจำนวนเงิน" });
    let slipUrl = null;
    if (req.file) {
      const result = await uploadStream(req.file.buffer, "sakunna/slips");
      slipUrl = result.secure_url;
    }
    const row = await M.create({
      staffName,
      amount: Number(amount),
      type: type || "salary",
      note: note || null,
      slipUrl,
      createdBy: req.user?.id || null,
      createdByName: req.user?.name || null,
    });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function deletePayroll(req, res) {
  try {
    const M = getModel();
    const row = await M.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    await row.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { listPayroll, createPayroll, deletePayroll };
