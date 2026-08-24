const router = require("express").Router();
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/expenseController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// เบิกเงินทั่วไป: admin + finance เข้าได้
router.get("/",           requireRole("admin", "finance"), ctrl.listExpenses);
router.post("/",          requireRole("admin", "finance"), upload.single("slip"), ctrl.createExpense);
router.delete("/:id",     requireRole("admin", "finance"), ctrl.deleteExpense);

module.exports = router;
