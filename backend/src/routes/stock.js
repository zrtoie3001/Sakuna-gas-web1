const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/stockController");
const ah = require("../middleware/asyncHandler");

router.get("/gas",              requireAuth, ah(ctrl.getGasStock));
router.post("/gas",             requireAuth, ah(ctrl.upsertGasStock));
router.post("/gas/adjust",      requireAuth, ah(ctrl.adjustGasStock));
router.get("/gas/logs",         requireAuth, ah(ctrl.getStockLogs));

router.get("/refills",          requireAuth, ah(ctrl.getRefills));
router.post("/refills",         requireAuth, ah(ctrl.addRefill));
router.delete("/refills/:id",   requireAuth, ah(ctrl.deleteRefill));

router.get("/equipment",        requireAuth, ah(ctrl.getEquipment));
router.post("/equipment",       requireAuth, ah(ctrl.createEquipment));
router.put("/equipment/:id",    requireAuth, ah(ctrl.updateEquipment));
router.delete("/equipment/:id", requireAuth, ah(ctrl.deleteEquipment));
router.post("/equipment/:id/sell", requireAuth, ah(ctrl.sellEquipment));

module.exports = router;
