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

// Admin: list customers — aggregated from orders table
async function listCustomers(req, res) {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const searchSql = search
      ? `AND (customer_name ILIKE :q OR customer_phone ILIKE :q)`
      : "";
    const replacements = { limit: parseInt(limit), offset };
    if (search) replacements.q = `%${search}%`;

    const rows = await seq.query(
      `SELECT
         COALESCE(NULLIF(TRIM(customer_phone),''), LOWER(TRIM(customer_name))) AS id,
         MAX(NULLIF(TRIM(customer_name),'')) AS name,
         MAX(NULLIF(TRIM(customer_phone),'')) AS phone,
         COUNT(id) AS "totalOrders",
         MAX(created_at) AS "lastOrderAt",
         MAX(delivery_address) AS "lastAddress"
       FROM orders
       WHERE status != 'cancelled'
         AND (NULLIF(TRIM(customer_name),'') IS NOT NULL OR NULLIF(TRIM(customer_phone),'') IS NOT NULL)
         ${searchSql}
       GROUP BY COALESCE(NULLIF(TRIM(customer_phone),''), LOWER(TRIM(customer_name)))
       ORDER BY MAX(created_at) DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countRow] = await seq.query(
      `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(customer_phone),''), LOWER(TRIM(customer_name)))) AS total
       FROM orders
       WHERE status != 'cancelled'
         AND (NULLIF(TRIM(customer_name),'') IS NOT NULL OR NULLIF(TRIM(customer_phone),'') IS NOT NULL)
         ${searchSql}`,
      { replacements: search ? { q: `%${search}%` } : {}, type: QueryTypes.SELECT }
    );

    res.json({
      customers: rows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        totalOrders: parseInt(r.totalOrders),
        lastOrderAt: r.lastOrderAt,
        lastAddress: r.lastAddress,
        addresses: [],
        pictureUrl: null,
      })),
      total: parseInt(countRow?.total || 0),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// Admin: orders for a customer looked up by phone or name (from orders table)
async function getCustomerOrdersByPhone(req, res) {
  try {
    const { phone, name } = req.query;
    if (!phone && !name) return res.json({ customer: null, orders: [] });
    const { Op } = require("sequelize");
    const where = phone
      ? { customerPhone: phone }
      : { customerName: { [Op.iLike]: name } };
    const orders = await Order.findAll({
      where: { ...where, status: { [Op.ne]: "cancelled" } },
      include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    res.json({ orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

module.exports = { getOrCreateCustomer, addAddress, getAddresses, listCustomers, getCustomerOrders, getCustomerOrdersByPhone };
