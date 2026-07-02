const router = require("express").Router();
const { StoreSetting } = require("../models");
const { requireAuth, requireRole } = require("../middleware/auth");

async function getSetting() {
  let s = await StoreSetting.findByPk(1);
  if (!s) s = await StoreSetting.create({ id: 1 });
  return s;
}

// Public — customer app reads this
router.get("/store", async (_req, res) => {
  const s = await getSetting();
  res.json(s);
});

// Admin only
router.put("/store", requireAuth, requireRole("admin"), async (req, res) => {
  const s = await getSetting();
  await s.update(req.body);
  res.json(s);
});

module.exports = router;
