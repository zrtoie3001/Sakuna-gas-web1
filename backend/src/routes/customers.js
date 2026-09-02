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
router.delete("/delete-customer", requireAuth, requireRole("admin"), ah(ctrl.deleteCustomer));
router.get("/:id/orders", requireAuth, requireRole("admin"), ah(ctrl.getCustomerOrders));

module.exports = router;
