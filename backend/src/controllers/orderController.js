const { Op } = require("sequelize");
const { v4: uuid } = require("uuid");
const { Order, Customer, DeliveryAddress, Brand, Product, DiscountCode, OrderStatusLog, DeliveryZone, ProductZonePrice, User } = require("../models");
const { getDeliveryInfo } = require("../services/mapsService");
const { sendOrderConfirmation, sendStatusUpdate, notifyAdminNewOrder } = require("../services/lineService");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");
const { appendOrder, updateOrderStatus } = require("../services/sheetsService");

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function pointInPolygon(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lat, yi = coords[i].lng;
    const xj = coords[j].lat, yj = coords[j].lng;
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

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
    unitPrice: unitPriceOverride,  // admin can override price
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
    deliveryFee = distanceKm > 3 ? 10 : 0;
    const lat = Number(deliveryLat), lng = Number(deliveryLng);
    const zones = await DeliveryZone.findAll({ where: { isActive: true } });
    zones.sort((a, b) => (a.maxKm == null ? 1 : b.maxKm == null ? -1 : a.maxKm - b.maxKm));
    // Polygon zones first
    for (const z of zones) {
      if (z.polygonCoords) {
        try {
          const coords = JSON.parse(z.polygonCoords);
          if (pointInPolygon(lat, lng, coords)) { zone = z; break; }
        } catch {}
      }
    }
    // Distance zones fallback
    if (!zone) {
      for (const z of zones) {
        if (!z.polygonCoords && !z.centerLat && z.maxKm && distanceKm <= z.maxKm) { zone = z; break; }
      }
    }
    if (!zone) return res.status(400).json({ error: "ที่อยู่อยู่นอกพื้นที่จัดส่ง" });
  } else {
    // Admin-created order: use first distance zone as default
    zone = (await DeliveryZone.findOne({ where: { isActive: true, centerLat: null }, order: [["maxKm", "ASC"]] })) || { name: "admin" };
  }

  // Price — admin can override, otherwise use homePrice
  const unitPrice = unitPriceOverride ? Number(unitPriceOverride) : Number(product.homePrice);

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

  // Deduct gas stock
  try {
    const { GasStock } = require("../models");
    const stock = await GasStock.findOne({ where: { brandName: brand.name, weightKg: Number(product.kg) } });
    if (stock && stock.hasGas >= qty) {
      await stock.update({ hasGas: stock.hasGas - qty });
    }
  } catch (e) { console.error("Stock deduct error:", e.message); }

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

  const prevStatus = order.status;
  await order.update({ status });
  await OrderStatusLog.create({ orderId: order.id, status, note, changedBy: req.user.id });

  // คืนสต็อกเมื่อยกเลิกออเดอร์ (และยังไม่เคยยกเลิกมาก่อน)
  if (status === "cancelled" && prevStatus !== "cancelled") {
    try {
      const { GasStock, Equipment } = require("../models");
      const n = order.note || "";
      if (n.startsWith("__walkin:")) {
        const walkin = JSON.parse(n.replace(/^__walkin:/, "").split("\n")[0]);
        if (walkin.type === "mixed" && Array.isArray(walkin.items)) {
          for (const it of walkin.items) {
            const q = Number(it.qty) || 1;
            if (it.type === "gas") {
              const stock = await GasStock.findOne({ where: { brandName: it.brandName, weightKg: Number(it.weightKg) } });
              if (stock) await stock.update({ hasGas: stock.hasGas + q });
            } else if (it.type === "new_tank") {
              const stock = await GasStock.findOne({ where: { brandName: it.brandName, weightKg: Number(it.weightKg) } });
              if (stock) await stock.update({ newTank: stock.newTank + q });
            } else if (it.type === "equipment" && it.equipId) {
              const eq = await Equipment.findByPk(it.equipId);
              if (eq) await eq.update({ qty: eq.qty + q });
            }
          }
        } else if (walkin.type === "gas") {
          const stock = await GasStock.findOne({ where: { brandName: walkin.brandName, weightKg: Number(walkin.weightKg) } });
          if (stock) await stock.update({ hasGas: stock.hasGas + (Number(walkin.qty) || 1) });
        } else if (walkin.type === "new_tank") {
          const stock = await GasStock.findOne({ where: { brandName: walkin.brandName, weightKg: Number(walkin.weightKg) } });
          if (stock) await stock.update({ newTank: stock.newTank + (Number(walkin.qty) || 1) });
        }
      } else if (order.productId) {
        // ออเดอร์ปกติ (ลูกค้าโทรสั่ง) — คืน hasGas
        const { Product: Prod } = require("../models");
        const prod = await Prod.findByPk(order.productId, { include: [{ model: require("../models").Brand, as: "brand" }] });
        if (prod) {
          const stock = await GasStock.findOne({ where: { brandName: prod.brand?.name, weightKg: Number(prod.kg) } });
          if (stock) await stock.update({ hasGas: stock.hasGas + (Number(order.qty) || 1) });
        }
      }
    } catch (e) { console.error("Stock restore error:", e.message); }
  }

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
            brandName, weightKg, qty, price, items,
            cartItems,  // new: mixed cart
            deliveryAddress: customAddress, orderStatus } = req.body;

    const { GasStock, Equipment, EquipmentSale } = require("../models");
    let total = 0;
    let walkinNote = note || "";
    let totalQty = 1;

    // ── Mixed cart (multiple items) ───────────────────────────────────────────
    if (type === "mixed" && cartItems && cartItems.length) {
      const noteItems = [];
      for (const it of cartItems) {
        const q = Number(it.qty) || 1;
        const p = Number(it.price) || 0;
        if (it.type === "gas") {
          const stock = await GasStock.findOne({ where: { brandName: it.brandName, weightKg: Number(it.weightKg) } });
          if (!stock) return res.status(400).json({ error: `ไม่พบสต็อก ${it.brandName} ${it.weightKg}กก.` });
          if (stock.hasGas < q) return res.status(400).json({ error: `สต็อก ${it.brandName} ${it.weightKg}กก. ไม่พอ (มี ${stock.hasGas} ถัง)` });
          await stock.update({ hasGas: stock.hasGas - q });
        } else if (it.type === "new_tank") {
          const stock = await GasStock.findOne({ where: { brandName: it.brandName, weightKg: Number(it.weightKg) } });
          if (!stock) return res.status(400).json({ error: `ไม่พบสต็อก ${it.brandName} ${it.weightKg}กก.` });
          if (stock.newTank < q) return res.status(400).json({ error: `ถังใหม่ ${it.brandName} ไม่พอ` });
          await stock.update({ newTank: stock.newTank - q });
        } else if (it.type === "equipment") {
          const eq = await Equipment.findByPk(it.equipId);
          if (!eq) return res.status(400).json({ error: `ไม่พบสินค้า: ${it.name}` });
          if (eq.qty < q) return res.status(400).json({ error: `สต็อก ${it.name} ไม่พอ` });
          await eq.update({ qty: eq.qty - q });
          await EquipmentSale.create({ equipmentId: eq.id, qty: q, salePrice: p, note: note || null });
        }
        total += p * q;
        noteItems.push({ ...it, qty: q, price: p });
      }
      walkinNote = `__walkin:${JSON.stringify({ type: "mixed", items: noteItems })}` + (note ? `\n${note}` : "");
      totalQty = cartItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);

    // ── Single gas ────────────────────────────────────────────────────────────
    } else if (type === "gas") {
      const q = Number(qty) || 1;
      if (!brandName || !weightKg) return res.status(400).json({ error: "กรุณาเลือกยี่ห้อและน้ำหนัก" });
      const stock = await GasStock.findOne({ where: { brandName, weightKg: Number(weightKg) } });
      if (!stock) return res.status(400).json({ error: "ไม่พบสินค้าในสต็อก" });
      if (stock.hasGas < q) return res.status(400).json({ error: `สต็อกไม่พอ (มีแค่ ${stock.hasGas} ถัง)` });
      total = Number(price) * q; totalQty = q;
      await stock.update({ hasGas: stock.hasGas - q });
      walkinNote = `__walkin:${JSON.stringify({ type: "gas", brandName, weightKg, qty: q, unitPrice: Number(price) })}` + (note ? `\n${note}` : "");

    // ── Single new tank ───────────────────────────────────────────────────────
    } else if (type === "new_tank") {
      const q = Number(qty) || 1;
      if (!brandName || !weightKg) return res.status(400).json({ error: "กรุณาเลือกยี่ห้อและน้ำหนัก" });
      const stock = await GasStock.findOne({ where: { brandName, weightKg: Number(weightKg) } });
      if (!stock) return res.status(400).json({ error: "ไม่พบสินค้าในสต็อก" });
      if (stock.newTank < q) return res.status(400).json({ error: `ถังใหม่ไม่พอ (มีแค่ ${stock.newTank} ถัง)` });
      total = Number(price) * q; totalQty = q;
      await stock.update({ newTank: stock.newTank - q });
      walkinNote = `__walkin:${JSON.stringify({ type: "new_tank", brandName, weightKg, qty: q, unitPrice: Number(price) })}` + (note ? `\n${note}` : "");

    // ── Equipment only ────────────────────────────────────────────────────────
    } else {
      if (!items || !items.length) return res.status(400).json({ error: "กรุณาเลือกสินค้า" });
      for (const it of items) {
        const eq = await Equipment.findByPk(it.id);
        if (!eq) return res.status(400).json({ error: `ไม่พบสินค้า: ${it.name}` });
        if (eq.qty < it.qty) return res.status(400).json({ error: `สต็อก ${it.name} ไม่พอ` });
        const itQty = Number(it.qty); const itPrice = Number(it.price);
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
      deliveryAddress: customAddress || "หน้าร้าน",
      paymentMethod: paymentMethod || "cash",
      qty: totalQty,
      unitPrice: total,
      subtotal: total,
      deliveryFee: 0,
      discountAmount: 0,
      total,
      note: walkinNote,
      status: orderStatus || "delivered",
    });

    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Admin: update order fields ────────────────────────────────────────────────
async function updateOrder(req, res) {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });

    const { customerName, customerPhone, deliveryAddress, qty, unitPrice, total, note, paymentMethod, status } = req.body;
    const updates = {};
    if (customerName   !== undefined) updates.customerName   = customerName;
    if (customerPhone  !== undefined) updates.customerPhone  = customerPhone;
    if (deliveryAddress !== undefined) updates.deliveryAddress = deliveryAddress;
    if (note           !== undefined) updates.note           = note;
    if (paymentMethod  !== undefined) updates.paymentMethod  = paymentMethod;
    if (status         !== undefined) updates.status         = status;
    if (qty            !== undefined) updates.qty            = Number(qty);
    if (unitPrice      !== undefined) updates.unitPrice      = Number(unitPrice);
    if (total          !== undefined) updates.total          = Number(total);
    else if (qty !== undefined && unitPrice !== undefined) {
      updates.subtotal = Number(qty) * Number(unitPrice);
      updates.total    = Number(qty) * Number(unitPrice);
    }

    await order.update(updates);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { createOrder, getOrderById, listOrders, updateStatus, acceptOrder, createWalkinOrder, updateOrder };
