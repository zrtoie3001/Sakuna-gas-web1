const router = require("express").Router();
const ctrl = require("../controllers/productController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/brands",        ctrl.getBrands);
router.get("/",              ctrl.getProducts);
router.get("/zones",         ctrl.getZones);

router.post("/brands",       requireAuth, requireRole("admin"), ctrl.createBrand);
router.put("/brands/:id",    requireAuth, requireRole("admin"), ctrl.updateBrand);
router.delete("/brands/:id", requireAuth, requireRole("admin"), ctrl.deleteBrand);
router.post("/",             requireAuth, requireRole("admin"), ctrl.createProduct);
router.put("/:id",           requireAuth, requireRole("admin"), ctrl.updateProduct);
router.delete("/:id",        requireAuth, requireRole("admin"), ctrl.deleteProduct);
router.put("/zones/:id",     requireAuth, requireRole("admin"), ctrl.updateZone);

module.exports = router;
