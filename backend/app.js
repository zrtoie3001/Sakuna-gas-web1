require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { sequelize } = require("./src/config/database");
const logger = require("./src/utils/logger");

const app = express();

// ── Security & Performance ────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.DRIVER_URL,
  "https://liff.line.me",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Webhook (ต้อง mount ก่อน express.json เพื่อให้ LINE middleware อ่าน raw body ได้) ──
app.use("/webhook", require("./src/routes/webhook"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/v1/auth",      require("./src/routes/auth"));
app.use("/api/v1/orders",    require("./src/routes/orders"));
app.use("/api/v1/products",  require("./src/routes/products"));
app.use("/api/v1/customers", require("./src/routes/customers"));
app.use("/api/v1/discounts", require("./src/routes/discounts"));
app.use("/api/v1/drivers",   require("./src/routes/drivers"));
app.use("/api/v1/reports",   require("./src/routes/reports"));
app.use("/api/v1/maps",      require("./src/routes/maps"));

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connected");
    await sequelize.sync({ alter: process.env.NODE_ENV === "development" });
    app.listen(PORT, () => logger.info(`API running on port ${PORT}`));
  } catch (err) {
    logger.error("Startup failed", err);
    process.exit(1);
  }
})();

module.exports = app;
