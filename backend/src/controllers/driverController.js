const bcrypt = require("bcryptjs");
const { User, Order, Brand, Product, Customer, CustomerLocation } = require("../models");
const { optimizeRoute } = require("../services/mapsService");

// Resolve best lat/lng for an order: saved pin > order GPS
// Tries customerId → phone → address in order until a pin is found
async function resolveOrderLoc(order) {
  const attempts = [];
  if (order.customerId) attempts.push({ customerId: order.customerId });
  if (order.customerPhone) attempts.push({ customerPhone: order.customerPhone });
  if (order.deliveryAddress) attempts.push({ customerAddress: order.deliveryAddress });

  for (const where of attempts) {
    const saved = await CustomerLocation.findOne({ where, order: [["updatedAt", "DESC"]] }).catch(() => null);
    if (saved?.latitude && saved?.longitude) {
      return { lat: Number(saved.latitude), lng: Number(saved.longitude), pinned: true };
    }
  }
  return { lat: Number(order.deliveryLat) || null, lng: Number(order.deliveryLng) || null, pinned: false };
}

async function listDrivers(req, res) {
  const { Op } = require("sequelize");
  // For assign-driver dropdown: only delivery staff; for finance page: all staff
  const driversOnly = req.query.role === "driver";
  const where = driversOnly
    ? { isActive: true, role: { [Op.in]: ["driver", "both"] } }
    : { isActive: true };
  const drivers = await User.findAll({
    where,
    attributes: { exclude: ["passwordHash"] },
    order: [["name", "ASC"]],
  });
  res.json(drivers);
}

async function createDriver(req, res) {
  try {
    const { name, email, phone, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const driver = await User.create({ name, email, phone, passwordHash, role: "driver" });
    res.status(201).json({ id: driver.id, name: driver.name, email: driver.email, role: driver.role });
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError")
      return res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
    res.status(500).json({ error: e.message });
  }
}

async function updateDriver(req, res) {
  try {
    const driver = await User.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ error: "Not found" });
    const { password, ...data } = req.body;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    await driver.update(data);
    res.json({ id: driver.id, name: driver.name, isActive: driver.isActive, role: driver.role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getMyOrders(req, res) {
  const { Op } = require("sequelize");
  // Today's start (driver sees today's delivered orders too)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const orders = await Order.findAll({
    where: {
      driverId: req.user.id,
      [Op.or]: [
        { status: ["preparing", "out_for_delivery"] },
        { status: "delivered", updatedAt: { [Op.gte]: todayStart } },
      ],
    },
    include: [
      { model: Brand, as: "brand" },
      { model: Product, as: "product" },
      { model: Customer, as: "customer" },
    ],
    order: [["createdAt", "ASC"]],
  });
  // Attach saved pin location to each order
  const enriched = await Promise.all(orders.map(async o => {
    const loc = await resolveOrderLoc(o);
    const plain = o.toJSON();
    plain.savedLat = loc.pinned ? loc.lat : null;
    plain.savedLng = loc.pinned ? loc.lng : null;
    return plain;
  }));
  res.json(enriched);
}

async function getPendingOrders(_req, res) {
  const orders = await Order.findAll({
    where: { status: "pending", driverId: null },
    include: [
      { model: Brand, as: "brand" },
      { model: Product, as: "product" },
    ],
    order: [["createdAt", "ASC"]],
  });
  res.json(orders);
}

async function getOptimizedRoute(req, res) {
  const { lat, lng } = req.query;
  const orders = await Order.findAll({
    where: { driverId: req.user.id, status: ["preparing", "out_for_delivery"] },
  });
  if (!orders.length) return res.json([]);

  const stops = await Promise.all(orders.map(async o => {
    const loc = await resolveOrderLoc(o);
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      lat: loc.lat,
      lng: loc.lng,
      address: o.deliveryAddress,
      customerName: o.customerName,
    };
  }));

  const optimized = await optimizeRoute(parseFloat(lat), parseFloat(lng), stops);
  res.json(optimized);
}

async function updateLocation(req, res) {
  const { lat, lng } = req.body;
  await req.user.update({ lastLocation: { lat, lng, updatedAt: new Date() } });
  res.json({ ok: true });
}

async function getDriverLocations(_req, res) {
  const drivers = await User.findAll({
    where: { role: "driver", isActive: true },
    attributes: ["id", "name", "lastLocation"],
  });
  res.json(drivers);
}

module.exports = {
  listDrivers, createDriver, updateDriver,
  getMyOrders, getPendingOrders, getOptimizedRoute,
  updateLocation, getDriverLocations,
};
