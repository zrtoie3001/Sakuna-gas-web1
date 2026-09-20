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

    // Group by (address, phone) — same address but different phone = different customer
    // If no phone, fall back to grouping by (address, name) so different people at same address are separated
    const addrKey = `LOWER(REGEXP_REPLACE(TRIM(delivery_address), '\\s+', ' ', 'g'))`;
    const phoneKey = `LOWER(TRIM(COALESCE(NULLIF(TRIM(customer_phone),''), NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน'), '')))`;
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
       GROUP BY ${groupKey}
       ORDER BY MAX(created_at) DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countRow] = await seq.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT ${groupKey}
         FROM orders
         WHERE status != 'cancelled'
           AND NULLIF(TRIM(delivery_address),'') IS NOT NULL
           ${searchSqlAddr}
         GROUP BY ${groupKey}
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

// Admin: orders for a customer looked up by address + phone/name combination
async function getCustomerOrdersByPhone(req, res) {
  try {
    const { phone, name, address } = req.query;
    if (!phone && !name && !address) return res.json({ customer: null, orders: [] });

    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");

    const addrNorm = `LOWER(REGEXP_REPLACE(TRIM(delivery_address), '\\s+', ' ', 'g'))`;
    const phoneNorm = `LOWER(TRIM(COALESCE(NULLIF(TRIM(customer_phone),''), NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน'), '')))`;

    let whereClause = `status != 'cancelled'`;
    const replacements = {};

    if (address) {
      const addrKey = address.toLowerCase().replace(/\s+/g, ' ').trim();
      whereClause += ` AND ${addrNorm} = :addrKey`;
      replacements.addrKey = addrKey;

      if (phone) {
        // Match phone OR orders where phone is empty (walkin orders stored phone in note)
        const phoneKey = phone.toLowerCase().trim();
        whereClause += ` AND (${phoneNorm} = :phoneKey OR COALESCE(NULLIF(TRIM(customer_phone),''),'') = '')`;
        replacements.phoneKey = phoneKey;
      } else if (name) {
        const nameKey = name.toLowerCase().replace(/\s+/g, ' ').trim();
        whereClause += ` AND ${phoneNorm} = :nameKey`;
        replacements.nameKey = nameKey;
      }
    } else if (phone) {
      whereClause += ` AND customer_phone = :phone`;
      replacements.phone = phone;
    } else {
      whereClause += ` AND LOWER(customer_name) ILIKE :name`;
      replacements.name = name;
    }

    const rows = await seq.query(
      `SELECT o.*,
        p.name AS "product_name", p.kg AS "product_kg",
        b.name AS "brand_name"
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       LEFT JOIN brands b ON o.brand_id = b.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT 200`,
      { replacements, type: QueryTypes.SELECT }
    );

    // Shape into the format frontend expects
    const orders = rows.map(r => ({
      ...r,
      product: r.product_name ? { name: r.product_name, kg: r.product_kg } : null,
      brand: r.brand_name ? { name: r.brand_name } : null,
    }));

    res.json({ orders });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// Admin: delete customer — clears delivery_address on all matching orders so they won't appear in list
async function deleteCustomer(req, res) {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "address required" });
    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");
    await seq.query(
      `UPDATE orders SET delivery_address = NULL
       WHERE LOWER(REGEXP_REPLACE(TRIM(delivery_address),'\\s+',' ','g')) = LOWER(REGEXP_REPLACE(TRIM(:address),'\\s+',' ','g'))
         AND status != 'cancelled'`,
      { replacements: { address }, type: QueryTypes.UPDATE }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// Admin: update customer contact info across all matching orders
async function updateCustomerContact(req, res) {
  try {
    const { oldAddress, oldPhone, newName, newPhone, newAddress } = req.body;
    if (!oldAddress) return res.status(400).json({ error: "oldAddress required" });

    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");

    // Build WHERE clause matching the customer's (address, phone) group key
    const normOld = `LOWER(REGEXP_REPLACE(TRIM(delivery_address),'\\s+',' ','g')) = LOWER(REGEXP_REPLACE(TRIM(:oldAddress),'\\s+',' ','g'))`;
    const phoneMatch = oldPhone
      ? `AND COALESCE(NULLIF(TRIM(customer_phone),''),'') = :oldPhone`
      : `AND COALESCE(NULLIF(TRIM(customer_phone),''),'') = ''`;

    const setClauses = [];
    const replacements = { oldAddress, oldPhone: oldPhone || "" };
    if (newName !== undefined) { setClauses.push(`customer_name = :newName`); replacements.newName = newName || null; }
    if (newPhone !== undefined) { setClauses.push(`customer_phone = :newPhone`); replacements.newPhone = newPhone || null; }
    if (newAddress !== undefined) { setClauses.push(`delivery_address = :newAddress`); replacements.newAddress = newAddress || null; }
    if (!setClauses.length) return res.status(400).json({ error: "Nothing to update" });

    const [, meta] = await seq.query(
      `UPDATE orders SET ${setClauses.join(", ")}
       WHERE ${normOld} ${phoneMatch} AND status != 'cancelled'`,
      { replacements, type: QueryTypes.UPDATE }
    );

    res.json({ updated: meta });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function getCustomerNote(req, res) {
  try {
    const { address, phone = "" } = req.query;
    if (!address) return res.json({ note: "" });
    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");
    const addrKey = address.toLowerCase().replace(/\s+/g, " ").trim();
    const [row] = await seq.query(
      `SELECT note FROM customer_notes WHERE address_key = :addrKey AND phone = :phone LIMIT 1`,
      { replacements: { addrKey, phone: phone || "" }, type: QueryTypes.SELECT }
    );
    res.json({ note: row?.note || "" });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function upsertCustomerNote(req, res) {
  try {
    const { address, phone = "", note } = req.body;
    if (!address) return res.status(400).json({ error: "address required" });
    const { sequelize: seq } = require("../config/database");
    const { QueryTypes } = require("sequelize");
    const addrKey = address.toLowerCase().replace(/\s+/g, " ").trim();
    await seq.query(
      `INSERT INTO customer_notes (address_key, phone, note, updated_at)
       VALUES (:addrKey, :phone, :note, NOW())
       ON CONFLICT (address_key, phone) DO UPDATE SET note = :note, updated_at = NOW()`,
      { replacements: { addrKey, phone: phone || "", note: note || "" }, type: QueryTypes.INSERT }
    );
    res.json({ ok: true });
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

module.exports = { getOrCreateCustomer, addAddress, getAddresses, listCustomers, getCustomerOrders, getCustomerOrdersByPhone, updateCustomerContact, deleteCustomer, getCustomerNote, upsertCustomerNote };
