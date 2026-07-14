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
app.set("trust proxy", 1);

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
app.use("/api/v1/stock",     require("./src/routes/stock"));
app.use("/api/v1/settings",  require("./src/routes/settings"));
app.use("/api/v1/debts",     require("./src/routes/debts"));

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

    // ── Manual migrations (idempotent) ─────────────────────────────────────────
    await sequelize.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS force_open BOOLEAN NOT NULL DEFAULT false;`).catch(() => {});
    await sequelize.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`).catch(() => {});
    await sequelize.query(`
      DO $$ BEGIN
        BEGIN ALTER TYPE enum_users_role ADD VALUE IF NOT EXISTS 'both';
        EXCEPTION WHEN duplicate_object THEN NULL; END;
      END $$;
    `).catch(() => {});
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20),
        type VARCHAR(10) NOT NULL DEFAULT 'money',
        amount NUMERIC(10,2) DEFAULT 0,
        tank_qty INTEGER DEFAULT 0,
        tank_desc VARCHAR(100),
        note TEXT,
        is_paid BOOLEAN DEFAULT false,
        paid_at TIMESTAMPTZ,
        tank_returned BOOLEAN DEFAULT false,
        tank_returned_at TIMESTAMPTZ,
        order_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `).catch(() => {});
    await sequelize.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;`).catch(() => {});
    logger.info("Migrations done");

    app.listen(PORT, () => logger.info(`API running on port ${PORT}`));
  } catch (err) {
    logger.error("Startup failed", err);
    process.exit(1);
  }
})();

module.exports = app;
