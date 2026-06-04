const router = require("express").Router();
const ctrl = require("../controllers/discountController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/validate", ctrl.validateCode);

router.get("/",      requireAuth, requireRole("admin"), ctrl.listCodes);
router.post("/",     requireAuth, requireRole("admin"), ctrl.createCode);
router.put("/:id",   requireAuth, requireRole("admin"), ctrl.updateCode);
router.delete("/:id",requireAuth, requireRole("admin"), ctrl.deleteCode);

module.exports = router;
