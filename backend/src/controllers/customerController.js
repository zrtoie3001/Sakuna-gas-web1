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

    const replacements = { limit: parseInt(limit), offset };
    const searchSqlAddr = search
      ? `AND (customer_name ILIKE :q OR customer_phone ILIKE :q OR delivery_address ILIKE :q)`
      : "";
    if (search) replacements.q = `%${search}%`;

    // Group by (address, phone) — same address + different phone = different customer
    const addrKey = `LOWER(REGEXP_REPLACE(TRIM(delivery_address), '\\s+', ' ', 'g'))`;
    const phoneKey = `COALESCE(NULLIF(TRIM(customer_phone),''), '')`;
    const groupKey = `${addrKey} || '|' || ${phoneKey}`;

    const rows = await seq.query(
      `SELECT
         ${groupKey} AS id,
         MAX(TRIM(delivery_address)) AS "lastAddress",
         MAX(NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน')) AS name,
         MAX(NULLIF(TRIM(customer_phone),'')) AS phone,
         COUNT(id) AS "totalOrders",
         MAX(created_at) AS "lastOrderAt"
       FROM orders
       WHERE status != 'cancelled'
         AND NULLIF(TRIM(delivery_address),'') IS NOT NULL
         ${searchSqlAddr}
       GROUP BY ${addrKey}, ${phoneKey}
       ORDER BY MAX(created_at) DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countRow] = await seq.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT ${addrKey}, ${phoneKey}
         FROM orders
         WHERE status != 'cancelled'
           AND NULLIF(TRIM(delivery_address),'') IS NOT NULL
           ${searchSqlAddr}
         GROUP BY ${addrKey}, ${phoneKey}
       ) sub`,
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

// Admin: orders for a customer looked up by phone, name, or address (from orders table)
async function getCustomerOrdersByPhone(req, res) {
  try {
    const { phone, name, address } = req.query;
    if (!phone && !name && !address) return res.json({ customer: null, orders: [] });
    const { Op } = require("sequelize");
    const where = phone
      ? { customerPhone: phone }
      : address
        ? { deliveryAddress: { [Op.iLike]: `%${address}%` } }
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
