const router = require("express").Router();
const ctrl = require("../controllers/productController");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");

router.get("/brands",        ah(ctrl.getBrands));
router.get("/",              ah(ctrl.getProducts));
router.get("/zones",              ah(ctrl.getZoneWithPrices));

router.post("/brands",            requireAuth, requireRole("admin"), ah(ctrl.createBrand));
router.put("/brands/:id",         requireAuth, requireRole("admin"), ah(ctrl.updateBrand));
router.delete("/brands/:id",      requireAuth, requireRole("admin"), ah(ctrl.deleteBrand));
router.post("/zones",             requireAuth, requireRole("admin"), ah(ctrl.createZone));
router.put("/zones/:id",          requireAuth, requireRole("admin"), ah(ctrl.updateZone));
router.delete("/zones/:id",       requireAuth, requireRole("admin"), ah(ctrl.deleteZone));
router.post("/",                  requireAuth, requireRole("admin"), ah(ctrl.createProduct));
router.put("/:id",                requireAuth, requireRole("admin"), ah(ctrl.updateProduct));
router.delete("/:id",             requireAuth, requireRole("admin"), ah(ctrl.deleteProduct));

module.exports = router;
