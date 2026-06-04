const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const { createOrder, getOrderById, listOrders, updateStatus, acceptOrder } = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");

const upload = multer({
  dest: process.env.UPLOAD_DIR || "./uploads",
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Image only"), ok);
  },
});

// Customer (no auth — identified by lineUserId in body)
router.post("/", createOrder);
router.get("/:id", getOrderById);

// Upload slip (customer)
router.post("/:id/slip", upload.single("slip"), async (req, res) => {
  const { Order } = require("../models");
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  await order.update({ slipUrl: `/uploads/${req.file.filename}` });
  res.json({ slipUrl: order.slipUrl });
});

// Staff
router.get("/", requireAuth, listOrders);
router.put("/:id/status", requireAuth, updateStatus);
router.post("/:id/accept", requireAuth, requireRole("driver", "admin"), acceptOrder);

module.exports = router;
