const router = require("express").Router();
const ctrl = require("../controllers/reportController");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/dashboard",    requireAuth, requireRole("admin"), ah(ctrl.dashboardStats));
router.get("/daily",        requireAuth, requireRole("admin"), ah(ctrl.dailyReport));
router.get("/monthly",      requireAuth, requireRole("admin"), ah(ctrl.monthlyReport));
router.get("/driver-stats", requireAuth, requireRole("admin"), ah(ctrl.driverStats));

module.exports = router;
