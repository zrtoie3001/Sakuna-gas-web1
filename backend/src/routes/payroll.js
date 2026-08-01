const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/payrollController");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads/slips"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pay_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// การเงิน (เบิกเงินพนักงาน): finance เท่านั้น
router.get("/",       requireRole("finance"), ctrl.listPayroll);
router.post("/",      requireRole("finance"), upload.single("slip"), ctrl.createPayroll);
router.delete("/:id", requireRole("finance"), ctrl.deletePayroll);

module.exports = router;
