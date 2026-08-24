const router = require("express").Router();
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/payrollController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// การเงิน (เบิกเงินพนักงาน): finance เท่านั้น
router.get("/",       requireRole("finance"), ctrl.listPayroll);
router.post("/",      requireRole("finance"), upload.single("slip"), ctrl.createPayroll);
router.delete("/:id", requireRole("finance"), ctrl.deletePayroll);

module.exports = router;
