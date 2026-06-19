const { Op } = require("sequelize");
const { v4: uuid } = require("uuid");
const { Order, Customer, DeliveryAddress, Brand, Product, DiscountCode, OrderStatusLog, DeliveryZone } = require("../models");
const { getDeliveryInfo } = require("../services/mapsService");
const { sendOrderConfirmation, sendStatusUpdate, notifyAdminNewOrder } = require("../services/lineService");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");

function generateOrderNumber() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `SKG${d.getFullYear().toString().slice(-2)}${pad(d.getMonth()+1)}${pad(d.getDate())}${String(Date.now()).slice(-4)}`;
}

// ── Customer: create order ────────────────────────────────────────────────────
async function createOrder(req, res) { try {
  const {
    lineUserId, brandId, productId, qty, customerName, customerPhone,
    deliveryLat, deliveryLng, deliveryAddress,
    paymentMethod, discountCode: codeStr, note,
  } = req.body;

  // Validate product
  const product = await Product.findByPk(productId);
  if (!product || !product.isActive) return res.status(400).json({ error: "Product not found" });

  const brand = await Brand.findByPk(brandId);
  if (!brand || !brand.isActive) return res.status(400).json({ error: "Brand not found" });

  // Distance & zone
  const { distanceKm, durationMins } = await getDeliveryInfo(deliveryLat, deliveryLng);

  // Determine zone
  const zones = await DeliveryZone.findAll({ where: { isActive: true }, order: [["maxKm", "ASC"]] });
  let zone = null;
  let deliveryFee = 0;
  for (const z of zones) {
    if (distanceKm <= z.maxKm) {
      zone = z;
      deliveryFee = 0; // ไม่คิดค่าส่งตอนนี้
      break;
    }
  }
  if (!zone) return res.status(400).json({ error: "ที่อยู่อยู่นอกพื้นที่จัดส่ง" });

  // Price
  let unitPrice = Number(product.homePrice);

  const subtotal = unitPrice * qty;

  // Discount
  let discountAmount = 0;
  let discountCodeRecord = null;
  if (codeStr) {
    discountCodeRecord = await DiscountCode.findOne({
      where: { code: codeStr.toUpperCase(), isActive: true },
    });
    if (!discountCodeRecord) return res.status(400).json({ error: "โค้ดส่วนลดไม่ถูกต้อง" });
    if (discountCodeRecord.expiresAt && new Date() > discountCodeRecord.expiresAt)
      return res.status(400).json({ error: "โค้ดหมดอายุแล้ว" });
    if (discountCodeRecord.maxUses && discountCodeRecord.usedCount >= discountCodeRecord.maxUses)
      return res.status(400).json({ error: "โค้ดถูกใช้ครบแล้ว" });
    if (subtotal < Number(discountCodeRecord.minOrderAmount))
      return res.status(400).json({ error: `ยอดขั้นต่ำ ฿${discountCodeRecord.minOrderAmount}` });
    if (discountCodeRecord.allowedProducts?.length && !discountCodeRecord.allowedProducts.includes(productId))
      return res.status(400).json({ error: "โค้ดนี้ใช้ได้เฉพาะบางสินค้าเท่านั้น" });

    discountAmount = discountCodeRecord.type === "percent"
      ? Math.round(subtotal * discountCodeRecord.value / 100)
      : Math.min(Number(discountCodeRecord.value), subtotal);
  }

  const total = subtotal + deliveryFee - discountAmount;

  // Upsert customer
  let customer = await Customer.findOne({ where: { lineUserId } });
  if (!customer) {
    customer = await Customer.create({ lineUserId, name: customerName, phone: customerPhone });
  } else {
    await customer.update({ name: customerName, phone: customerPhone, totalOrders: customer.totalOrders + 1 });
  }

  // Save address
  const existingAddr = await DeliveryAddress.findOne({
    where: { customerId: customer.id, address: deliveryAddress },
  });
  if (!existingAddr) {
    await DeliveryAddress.create({
      customerId: customer.id,
      address: deliveryAddress,
      lat: deliveryLat,
      lng: deliveryLng,
    });
  }

  const offHours = !isOpen();

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    customerId: customer.id,
    brandId,
    productId,
    qty,
    unitPrice,
    subtotal,
    deliveryFee,
    discountAmount,
    total,
    discountCodeId: discountCodeRecord?.id,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryLat,
    deliveryLng,
    distanceKm,
    zone: zone.name,
    paymentMethod,
    note,
  });

  // Increment discount usage
  if (discountCodeRecord) {
    await discountCodeRecord.increment("usedCount");
  }

  // Fetch full order with associations
  const fullOrder = await Order.findByPk(order.id, {
    include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
  });

  // Notify
  if (lineUserId) {
    sendOrderConfirmation(lineUserId, fullOrder).catch(() => {});
    notifyAdminNewOrder(fullOrder).catch(() => {});
  }

  res.status(201).json({ order: fullOrder });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Get single order (customer track) ─────────────────────────────────────────
async function getOrderById(req, res) {
  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: Brand, as: "brand" },
      { model: Product, as: "product" },
      { model: OrderStatusLog, as: "statusLogs", order: [["createdAt", "ASC"]] },
    ],
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
}

// ── Admin: list orders ────────────────────────────────────────────────────────
async function listOrders(req, res) {
  const { status, date, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    where.createdAt = { [Op.between]: [start, end] };
  }
  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [
      { model: Brand, as: "brand" },
      { model: Product, as: "product" },
      { model: Customer, as: "customer" },
    ],
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: (page - 1) * parseInt(limit),
  });
  res.json({ orders: rows, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
}

// ── Admin/Driver: update status ───────────────────────────────────────────────
async function updateStatus(req, res) {
  const { status, note } = req.body;
  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: Brand, as: "brand" },
      { model: Product, as: "product" },
      { model: Customer, as: "customer" },
    ],
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (req.user.role === "driver" && !["out_for_delivery", "near_destination", "delivered"].includes(status))
    return res.status(403).json({ error: "Driver cannot set this status" });

  await order.update({ status });
  await OrderStatusLog.create({ orderId: order.id, status, note, changedBy: req.user.id });

  // LINE notification
  if (order.customer?.lineUserId) {
    sendStatusUpdate(order.customer.lineUserId, order, status).catch(() => {});
  }

  res.json(order);
}

// ── Driver: accept order ──────────────────────────────────────────────────────
async function acceptOrder(req, res) {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status !== "pending") return res.status(400).json({ error: "Order already taken" });
  await order.update({ driverId: req.user.id, status: "preparing" });
  await OrderStatusLog.create({ orderId: order.id, status: "preparing", changedBy: req.user.id });
  res.json(order);
}

module.exports = { createOrder, getOrderById, listOrders, updateStatus, acceptOrder };
