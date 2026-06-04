const router = require("express").Router();
const ctrl = require("../controllers/customerController");
const { requireAuth, requireRole } = require("../middleware/auth");

// Customer self-service (by lineUserId)
router.get("/line/:lineUserId",          ctrl.getOrCreateCustomer);
router.get("/line/:lineUserId/addresses", ctrl.getAddresses);
router.post("/line/:lineUserId/addresses", ctrl.addAddress);

// Admin
router.get("/",        requireAuth, requireRole("admin"), ctrl.listCustomers);
router.get("/:id/orders", requireAuth, requireRole("admin"), ctrl.getCustomerOrders);

module.exports = router;
