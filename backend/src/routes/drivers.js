const router = require("express").Router();
const ctrl = require("../controllers/driverController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Driver self
router.get("/my-orders",   requireAuth, requireRole("driver"), ctrl.getMyOrders);
router.get("/pending",     requireAuth, requireRole("driver", "admin"), ctrl.getPendingOrders);
router.get("/route",       requireAuth, requireRole("driver"), ctrl.getOptimizedRoute);
router.put("/location",    requireAuth, requireRole("driver"), ctrl.updateLocation);

// Admin
router.get("/",            requireAuth, requireRole("admin"), ctrl.listDrivers);
router.get("/locations",   requireAuth, requireRole("admin"), ctrl.getDriverLocations);
router.post("/",           requireAuth, requireRole("admin"), ctrl.createDriver);
router.put("/:id",         requireAuth, requireRole("admin"), ctrl.updateDriver);

module.exports = router;
