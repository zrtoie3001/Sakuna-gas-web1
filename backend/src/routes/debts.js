const router = require("express").Router();
const { Debt } = require("../models");
const { requireAuth } = require("../middleware/auth");
const { Op } = require("sequelize");

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { unpaid, type, search } = req.query;
    const where = {};
    if (type) where.type = type;
    if (unpaid === "1") where[Op.or] = [
      { type: "money", isPaid: false },
      { type: "tank",  tankReturned: false },
      { type: "both",  [Op.or]: [{ isPaid: false }, { tankReturned: false }] },
    ];
    if (search) where[Op.or] = [
      { customerName: { [Op.iLike]: `%${search}%` } },
      { customerPhone: { [Op.iLike]: `%${search}%` } },
    ];
    const debts = await Debt.findAll({ where, order: [["createdAt", "DESC"]] });
    res.json(debts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.amount === "" || body.amount === null) body.amount = 0;
    if (body.tankQty === "" || body.tankQty === null) body.tankQty = 0;
    body.amount  = Number(body.amount)  || 0;
    body.tankQty = Number(body.tankQty) || 0;
    const debt = await Debt.create(body);
    res.status(201).json(debt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    if (!debt) return res.status(404).json({ error: "Not found" });
    const patch = { ...req.body };
    if (patch.isPaid && !debt.isPaid) patch.paidAt = new Date();
    if (patch.tankReturned && !debt.tankReturned) patch.tankReturnedAt = new Date();
    await debt.update(patch);
    res.json(debt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const debt = await Debt.findByPk(req.params.id);
    if (!debt) return res.status(404).json({ error: "Not found" });
    await debt.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
