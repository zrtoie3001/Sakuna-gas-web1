const { Op } = require("sequelize");
const { Expense } = require("../models");

async function listExpenses(req, res) {
  const { from, to, type, page = 1, limit = 50 } = req.query;
  const where = {};
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {};
    if (from) { const d = new Date(from); d.setHours(0,0,0,0); where.createdAt[Op.gte] = d; }
    if (to)   { const d = new Date(to);   d.setHours(23,59,59,999); where.createdAt[Op.lte] = d; }
  }
  const { rows, count } = await Expense.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: (page - 1) * parseInt(limit),
  });
  res.json({ expenses: rows, total: count });
}

async function createExpense(req, res) {
  try {
    const { type, amount, description } = req.body;
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "กรุณาระบุจำนวนเงิน" });
    const slipUrl = req.file ? `/uploads/slips/${req.file.filename}` : null;
    const expense = await Expense.create({
      type: type || "other",
      amount: Number(amount),
      description: description || null,
      slipUrl,
      createdBy: req.user?.id || null,
    });
    res.status(201).json(expense);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function deleteExpense(req, res) {
  const expense = await Expense.findByPk(req.params.id);
  if (!expense) return res.status(404).json({ error: "Not found" });
  await expense.destroy();
  res.json({ ok: true });
}

module.exports = { listExpenses, createExpense, deleteExpense };
