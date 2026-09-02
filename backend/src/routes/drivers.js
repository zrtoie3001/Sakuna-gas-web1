const router = require("express").Router();
const ctrl = require("../controllers/driverController");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

// Driver self
router.get("/my-orders",   requireAuth, requireRole("driver"), ah(ctrl.getMyOrders));
router.get("/pending",     requireAuth, requireRole("driver", "admin"), ah(ctrl.getPendingOrders));
router.get("/route",       requireAuth, requireRole("driver"), ah(ctrl.getOptimizedRoute));
router.put("/location",    requireAuth, requireRole("driver"), ah(ctrl.updateLocation));

// Finance only (finance role inherits admin via middleware)
router.get("/",            requireAuth, requireRole("admin", "finance"), ah(ctrl.listDrivers));
router.get("/locations",   requireAuth, requireRole("admin"),   ah(ctrl.getDriverLocations));
router.post("/",           requireAuth, requireRole("finance"), ah(ctrl.createDriver));
router.put("/:id",         requireAuth, requireRole("finance"), ah(ctrl.updateDriver));

module.exports = router;
