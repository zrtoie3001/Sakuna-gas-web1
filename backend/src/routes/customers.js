const router = require("express").Router();
const ctrl = require("../controllers/customerController");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

// Customer self-service (by lineUserId)
router.get("/line/:lineUserId",          ah(ctrl.getOrCreateCustomer));
router.get("/line/:lineUserId/addresses", ah(ctrl.getAddresses));
router.post("/line/:lineUserId/addresses", ah(ctrl.addAddress));

// Admin
router.get("/",        requireAuth, requireRole("admin"), ah(ctrl.listCustomers));
router.get("/orders-by-contact", requireAuth, requireRole("admin"), ah(ctrl.getCustomerOrdersByPhone));
router.patch("/update-contact", requireAuth, requireRole("admin"), ah(ctrl.updateCustomerContact));
router.patch("/update-contact-order", requireAuth, ah(ctrl.updateContactFromOrder));
router.delete("/delete-customer", requireAuth, requireRole("admin"), ah(ctrl.deleteCustomer));
router.get("/note", requireAuth, requireRole("admin"), ah(ctrl.getCustomerNote));
router.put("/note", requireAuth, requireRole("admin"), ah(ctrl.upsertCustomerNote));
router.get("/:id/orders", requireAuth, requireRole("admin"), ah(ctrl.getCustomerOrders));

// Location endpoints — auth optional so drivers can use
router.get("/location/by-contact",  requireAuth, ah(ctrl.getLocationByContact));
router.post("/location/save",        requireAuth, ah(ctrl.saveLocation));
router.put("/location/:locId",       requireAuth, ah(ctrl.updateLocation));
router.delete("/location/:locId",    requireAuth, requireRole("admin"), ah(ctrl.deleteLocation));
router.get("/locations/today-map",   requireAuth, ah(ctrl.todayDeliveryLocations));

module.exports = router;
