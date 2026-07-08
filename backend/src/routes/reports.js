const router = require("express").Router();
const ctrl = require("../controllers/reportController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/dashboard",    requireAuth, requireRole("admin"), ctrl.dashboardStats);
router.get("/daily",        requireAuth, requireRole("admin"), ctrl.dailyReport);
router.get("/monthly",      requireAuth, requireRole("admin"), ctrl.monthlyReport);
router.get("/driver-stats", requireAuth, requireRole("admin"), ctrl.driverStats);

module.exports = router;
