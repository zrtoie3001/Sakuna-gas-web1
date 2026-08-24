const router = require("express").Router();
const { CashFloat, Order, Expense } = require("../models");
const { requireAuth, requireRole } = require("../middleware/auth");
const { Op, fn, col } = require("sequelize");

// GET /api/v1/cash-float?date=YYYY-MM-DD — summary for a day
router.get("/", requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);

    const [floatRow, cashOrders, expenses] = await Promise.all([
      CashFloat.findOne({ where: { date } }),
      Order.findAll({
        where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" }, paymentMethod: "cash", isPaid: true },
        attributes: ["total"],
        raw: true,
      }),
      Expense.findAll({
        where: { createdAt: { [Op.between]: [start, end] } },
        attributes: ["amount", "type", "description", "createdByName"],
        raw: true,
      }),
    ]);

    const startAmount  = Number(floatRow?.startAmount || 0);
    const cashIn       = cashOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const cashOut      = expenses.filter(e => e.type !== "collect").reduce((s, e) => s + Number(e.amount || 0), 0);
    const collected    = expenses.filter(e => e.type === "collect").reduce((s, e) => s + Number(e.amount || 0), 0);
    const balance      = startAmount + cashIn - cashOut - collected;

    res.json({
      date,
      startAmount,
      cashIn,
      cashOut,
      collected,
      balance,
      cashOrders: cashOrders.length,
      expenses,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/v1/cash-float — set/update starting amount for a date
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { date, startAmount, note } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });
    const [row] = await CashFloat.upsert({ date, startAmount: Number(startAmount) || 0, note: note || null });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
