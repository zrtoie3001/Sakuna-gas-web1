const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/expenseController");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads/slips"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `slip_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

router.get("/",           requireRole("admin", "finance"), ctrl.listExpenses);
router.post("/",          requireRole("admin", "finance"), upload.single("slip"), ctrl.createExpense);
router.delete("/:id",     requireRole("admin", "finance"), ctrl.deleteExpense);

module.exports = router;
