const { Op } = require("sequelize");
const { v4: uuid } = require("uuid");
const { Order, Customer, DeliveryAddress, Brand, Product, DiscountCode, OrderStatusLog, DeliveryZone, User } = require("../models");
const { getDeliveryInfo } = require("../services/mapsService");
const { sendOrderConfirmation, sendStatusUpdate, notifyAdminNewOrder } = require("../services/lineService");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");
const { appendOrder, updateOrderStatus } = require("../services/sheetsService");

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

  // Distance & zone (skip when admin creates order without coordinates)
  let distanceKm = 0, zone = null, deliveryFee = 0;
  if (deliveryLat && deliveryLng) {
    const info = await getDeliveryInfo(deliveryLat, deliveryLng);
    distanceKm = info.distanceKm;
    const zones = await DeliveryZone.findAll({ where: { isActive: true }, order: [["maxKm", "ASC"]] });
    for (const z of zones) {
      if (distanceKm <= z.maxKm) { zone = z; break; }
    }
    if (!zone) return res.status(400).json({ error: "ที่อยู่อยู่นอกพื้นที่จัดส่ง" });
  } else {
    // Admin-created order: use first zone as default
    zone = (await DeliveryZone.findOne({ where: { isActive: true }, order: [["maxKm", "ASC"]] })) || { name: "admin" };
  }

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

  // Upsert customer (lineUserId may be absent for admin-created orders)
  let customer = null;
  if (lineUserId) {
    customer = await Customer.findOne({ where: { lineUserId } });
    if (!customer) {
      customer = await Customer.create({ lineUserId, name: customerName, phone: customerPhone });
    } else {
      await customer.update({ name: customerName, phone: customerPhone, totalOrders: customer.totalOrders + 1 });
    }
  } else if (customerPhone) {
    customer = await Customer.findOne({ where: { phone: customerPhone } });
    if (!customer) {
      customer = await Customer.create({ name: customerName || "ลูกค้าทั่วไป", phone: customerPhone });
    }
  }

  // Save address (only if customer record exists)
  if (customer && deliveryAddress) {
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
  }

  const offHours = !isOpen();

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    customerId: customer?.id || null,
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
  appendOrder(fullOrder).catch(() => {});

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
      { model: User, as: "driver", attributes: ["id", "name"], required: false },
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

  if (req.user.role === "driver" && !["out_for_delivery", "delivered"].includes(status))
    return res.status(403).json({ error: "Driver cannot set this status" });

  await order.update({ status });
  await OrderStatusLog.create({ orderId: order.id, status, note, changedBy: req.user.id });

  // LINE notification
  if (order.customer?.lineUserId) {
    sendStatusUpdate(order.customer.lineUserId, order, status).catch(() => {});
  }
  updateOrderStatus(order).catch(() => {});

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

// ── Walk-in sale: create order record ────────────────────────────────────────
async function createWalkinOrder(req, res) {
  try {
    const { type, customerName, customerPhone, paymentMethod, note,
            brandName, weightKg, qty, price, items } = req.body;

    const { GasStock, Equipment, EquipmentSale } = require("../models");
    const q = Number(qty) || 1;
    let total = 0;
    let walkinNote = note || "";

    if (type === "gas") {
      if (!brandName || !weightKg) return res.status(400).json({ error: "กรุณาเลือกยี่ห้อและน้ำหนัก" });
      const stock = await GasStock.findOne({ where: { brandName, weightKg: Number(weightKg) } });
      if (!stock) return res.status(400).json({ error: "ไม่พบสินค้าในสต็อก" });
      if (stock.hasGas < q) return res.status(400).json({ error: `สต็อกไม่พอ (มีแค่ ${stock.hasGas} ถัง)` });
      total = Number(price) * q;
      await stock.update({ hasGas: stock.hasGas - q });
      walkinNote = `__walkin:${JSON.stringify({ type: "gas", brandName, weightKg, qty: q, unitPrice: Number(price) })}` + (note ? `\n${note}` : "");
    } else {
      if (!items || !items.length) return res.status(400).json({ error: "กรุณาเลือกสินค้า" });
      for (const it of items) {
        const eq = await Equipment.findByPk(it.id);
        if (!eq) return res.status(400).json({ error: `ไม่พบสินค้า: ${it.name}` });
        if (eq.qty < it.qty) return res.status(400).json({ error: `สต็อก ${it.name} ไม่พอ` });
        const itQty = Number(it.qty);
        const itPrice = Number(it.price);
        await eq.update({ qty: eq.qty - itQty });
        await EquipmentSale.create({ equipmentId: eq.id, qty: itQty, salePrice: itPrice, note: note || null });
        total += itPrice * itQty;
      }
      walkinNote = `__walkin:${JSON.stringify({ type: "equipment", items })}` + (note ? `\n${note}` : "");
    }

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customerName: customerName || "ลูกค้าหน้าร้าน",
      customerPhone: customerPhone || null,
      deliveryAddress: "หน้าร้าน",
      paymentMethod: paymentMethod || "cash",
      qty: q,
      unitPrice: type === "gas" ? Number(price) : total,
      subtotal: total,
      deliveryFee: 0,
      discountAmount: 0,
      total,
      note: walkinNote,
      status: "delivered",
    });

    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { createOrder, getOrderById, listOrders, updateStatus, acceptOrder, createWalkinOrder };
