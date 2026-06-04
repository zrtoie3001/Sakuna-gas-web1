const { Customer, DeliveryAddress, Order, Brand, Product } = require("../models");

async function getOrCreateCustomer(req, res) {
  const { lineUserId } = req.params;
  let customer = await Customer.findOne({
    where: { lineUserId },
    include: [{ model: DeliveryAddress, as: "addresses" }],
  });
  if (!customer) return res.json(null);

  const recentOrders = await Order.findAll({
    where: { customerId: customer.id },
    include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
    order: [["createdAt", "DESC"]],
    limit: 5,
  });

  res.json({ ...customer.toJSON(), recentOrders });
}

async function addAddress(req, res) {
  const { lineUserId } = req.params;
  const customer = await Customer.findOne({ where: { lineUserId } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const { label, address, lat, lng, isDefault } = req.body;
  if (isDefault) await DeliveryAddress.update({ isDefault: false }, { where: { customerId: customer.id } });
  const addr = await DeliveryAddress.create({ customerId: customer.id, label, address, lat, lng, isDefault });
  res.status(201).json(addr);
}

async function getAddresses(req, res) {
  const customer = await Customer.findOne({ where: { lineUserId: req.params.lineUserId } });
  if (!customer) return res.json([]);
  const addresses = await DeliveryAddress.findAll({ where: { customerId: customer.id }, order: [["isDefault", "DESC"], ["createdAt", "DESC"]] });
  res.json(addresses);
}

// Admin: list customers
async function listCustomers(req, res) {
  const { page = 1, limit = 20, search } = req.query;
  const { Op } = require("sequelize");
  const where = search ? {
    [Op.or]: [
      { name: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ],
  } : {};
  const { rows, count } = await Customer.findAndCountAll({
    where,
    include: [{ model: DeliveryAddress, as: "addresses" }],
    order: [["totalOrders", "DESC"]],
    limit: parseInt(limit),
    offset: (page - 1) * parseInt(limit),
  });
  res.json({ customers: rows, total: count });
}

async function getCustomerOrders(req, res) {
  const customer = await Customer.findByPk(req.params.id);
  if (!customer) return res.status(404).json({ error: "Not found" });
  const orders = await Order.findAll({
    where: { customerId: customer.id },
    include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
    order: [["createdAt", "DESC"]],
  });
  res.json({ customer, orders });
}

module.exports = { getOrCreateCustomer, addAddress, getAddresses, listCustomers, getCustomerOrders };
