const router = require("express").Router();
const ctrl = require("../controllers/discountController");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.post("/validate", ah(ctrl.validateCode));

router.get("/",      requireAuth, requireRole("admin"), ah(ctrl.listCodes));
router.post("/",     requireAuth, requireRole("admin"), ah(ctrl.createCode));
router.put("/:id",   requireAuth, requireRole("admin"), ah(ctrl.updateCode));
router.delete("/:id",requireAuth, requireRole("admin"), ah(ctrl.deleteCode));

module.exports = router;
