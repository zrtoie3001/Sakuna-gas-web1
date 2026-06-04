-- ════════════════════════════════════════════════════════
--  สกุณาแก๊ส — Database Schema (PostgreSQL)
--  Generated: 2024
-- ════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users (admin + driver) ─────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'driver' CHECK (role IN ('admin','driver')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_location JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── customers ──────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id VARCHAR(100) UNIQUE,
  name         VARCHAR(100),
  phone        VARCHAR(20),
  picture_url  TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── delivery_addresses ─────────────────────────────────────────────────────
CREATE TABLE delivery_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label       VARCHAR(50) NOT NULL DEFAULT 'บ้าน',
  address     TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── brands ─────────────────────────────────────────────────────────────────
CREATE TABLE brands (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  logo_url   TEXT,
  color      VARCHAR(20) DEFAULT '#1A2B6B',
  bg_color   VARCHAR(20) DEFAULT '#EEF2FF',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── products ───────────────────────────────────────────────────────────────
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  kg          DECIMAL(6,2),
  home_price  DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_hot      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── delivery_zones ─────────────────────────────────────────────────────────
CREATE TABLE delivery_zones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(50) NOT NULL UNIQUE,  -- A, B, C ...
  label        VARCHAR(100),
  max_km       DECIMAL(6,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  color        VARCHAR(20),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── product_zone_prices (ราคาร้านค้าแยกตามโซน) ────────────────────────────
CREATE TABLE product_zone_prices (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  zone_id    UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
  price      DECIMAL(10,2) NOT NULL,
  UNIQUE(product_id, zone_id)
);

-- ── discount_codes ─────────────────────────────────────────────────────────
CREATE TABLE discount_codes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(30) NOT NULL UNIQUE,
  type             VARCHAR(10) NOT NULL CHECK (type IN ('fixed','percent')),
  value            DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_uses         INTEGER,
  used_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  allowed_zones    TEXT[],     -- NULL = ทุกโซน
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ─────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number     VARCHAR(20) NOT NULL UNIQUE,
  customer_id      UUID REFERENCES customers(id),
  driver_id        UUID REFERENCES users(id),
  brand_id         UUID REFERENCES brands(id),
  product_id       UUID REFERENCES products(id),
  discount_code_id UUID REFERENCES discount_codes(id),
  qty              INTEGER NOT NULL DEFAULT 1,
  unit_price       DECIMAL(10,2) NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  customer_name    VARCHAR(100),
  customer_phone   VARCHAR(20),
  delivery_address TEXT,
  delivery_lat     DECIMAL(10,7),
  delivery_lng     DECIMAL(10,7),
  distance_km      DECIMAL(8,2),
  zone             VARCHAR(10),
  customer_type    VARCHAR(10) NOT NULL DEFAULT 'home' CHECK (customer_type IN ('home','shop')),
  payment_method   VARCHAR(10) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','qr')),
  slip_url         TEXT,
  note             TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','preparing','out_for_delivery','near_destination','delivered','cancelled')),
  estimated_minutes INTEGER,
  is_off_hours     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── order_status_logs ──────────────────────────────────────────────────────
CREATE TABLE order_status_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  note        TEXT,
  changed_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_customer_id   ON orders(customer_id);
CREATE INDEX idx_orders_driver_id     ON orders(driver_id);
CREATE INDEX idx_orders_created_at    ON orders(created_at);
CREATE INDEX idx_customers_line_id    ON customers(line_user_id);
CREATE INDEX idx_customers_phone      ON customers(phone);
CREATE INDEX idx_delivery_addresses_customer ON delivery_addresses(customer_id);
CREATE INDEX idx_status_logs_order_id ON order_status_logs(order_id);

-- ── Auto-update updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','customers','delivery_addresses','brands','products','delivery_zones','discount_codes','orders','order_status_logs']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;
