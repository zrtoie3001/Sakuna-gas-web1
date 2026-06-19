const bcrypt = require("bcryptjs");
const { User, Order, Brand, Product, Customer } = require("../models");
const { optimizeRoute } = require("../services/mapsService");

async function listDrivers(_req, res) {
  const drivers = await User.findAll({
    where: { role: "driver" },
    attributes: { exclude: ["passwordHash"] },
  });
  res.json(drivers);
}

async function createDriver(req, res) {
  const { name, email, phone, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const driver = await User.create({ name, email, phone, passwordHash, role: "driver" });
  res.status(201).json({ id: driver.id, name: driver.name, email: driver.email, role: driver.role });
}

async function updateDriver(req, res) {
  const driver = await User.findOne({ where: { id: req.params.id, role: "driver" } });
  if (!driver) return res.status(404).json({ error: "Not found" });
  const { password, ...data } = req.body;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  await driver.update(data);
  res.json({ id: driver.id, name: driver.name, isActive: driver.isActive });
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
  res.json(orders);
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

  const stops = orders.map(o => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    lat: Number(o.deliveryLat),
    lng: Number(o.deliveryLng),
    address: o.deliveryAddress,
    customerName: o.customerName,
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
