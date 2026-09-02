const router = require("express").Router();
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../middleware/asyncHandler");
const ctrl = require("../controllers/payrollController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// การเงิน (เบิกเงินพนักงาน): finance เท่านั้น
router.get("/",       requireRole("finance"), ah(ctrl.listPayroll));
router.post("/",      requireRole("finance"), upload.single("slip"), ah(ctrl.createPayroll));
router.delete("/:id", requireRole("finance"), ah(ctrl.deletePayroll));

module.exports = router;
