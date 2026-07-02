const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/stockController");

router.get("/gas",              requireAuth, ctrl.getGasStock);
router.post("/gas",             requireAuth, ctrl.upsertGasStock);
router.post("/gas/adjust",      requireAuth, ctrl.adjustGasStock);
router.get("/gas/logs",         requireAuth, ctrl.getStockLogs);

router.get("/refills",          requireAuth, ctrl.getRefills);
router.post("/refills",         requireAuth, ctrl.addRefill);

router.get("/equipment",        requireAuth, ctrl.getEquipment);
router.post("/equipment",       requireAuth, ctrl.createEquipment);
router.put("/equipment/:id",    requireAuth, ctrl.updateEquipment);
router.delete("/equipment/:id", requireAuth, ctrl.deleteEquipment);
router.post("/equipment/:id/sell", requireAuth, ctrl.sellEquipment);

module.exports = router;
