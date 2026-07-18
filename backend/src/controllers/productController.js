const { Brand, Product, DeliveryZone, ProductZonePrice } = require("../models");

async function getBrands(_req, res) {
  const brands = await Brand.findAll({ where: { isActive: true }, order: [["sortOrder", "ASC"]] });
  res.json(brands);
}

async function getProducts(_req, res) {
  const products = await Product.findAll({
    where: { isActive: true },
    include: [{ model: ProductZonePrice, as: "zonePrices", include: [{ model: DeliveryZone, as: "zone" }] }],
    order: [["sortOrder", "ASC"]],
  });
  res.json(products);
}

async function createBrand(req, res) {
  const brand = await Brand.create(req.body);
  res.status(201).json(brand);
}

async function updateBrand(req, res) {
  const brand = await Brand.findByPk(req.params.id);
  if (!brand) return res.status(404).json({ error: "Not found" });
  await brand.update(req.body);
  res.json(brand);
}

async function createProduct(req, res) {
  const { zonePrices, ...data } = req.body;
  const product = await Product.create(data);
  if (zonePrices) {
    await ProductZonePrice.bulkCreate(zonePrices.map(zp => ({ ...zp, productId: product.id })));
  }
  res.status(201).json(product);
}

async function updateProduct(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  const { zonePrices, ...data } = req.body;
  await product.update(data);
  if (zonePrices) {
    await ProductZonePrice.destroy({ where: { productId: product.id } });
    await ProductZonePrice.bulkCreate(zonePrices.map(zp => ({ ...zp, productId: product.id })));
  }
  res.json(product);
}

async function getZones(_req, res) {
  const zones = await DeliveryZone.findAll({ where: { isActive: true }, order: [["maxKm", "ASC"]] });
  res.json(zones);
}

async function updateZone(req, res) {
  const zone = await DeliveryZone.findByPk(req.params.id);
  if (!zone) return res.status(404).json({ error: "Not found" });
  const { zonePrices, ...data } = req.body;
  await zone.update(data);
  if (zonePrices) {
    await ProductZonePrice.destroy({ where: { zoneId: zone.id } });
    await ProductZonePrice.bulkCreate(zonePrices.map(zp => ({ ...zp, zoneId: zone.id })));
  }
  res.json(zone);
}

async function createZone(req, res) {
  const { zonePrices, ...data } = req.body;
  const zone = await DeliveryZone.create(data);
  if (zonePrices?.length) {
    await ProductZonePrice.bulkCreate(zonePrices.map(zp => ({ ...zp, zoneId: zone.id })));
  }
  res.status(201).json(zone);
}

async function deleteZone(req, res) {
  const zone = await DeliveryZone.findByPk(req.params.id);
  if (!zone) return res.status(404).json({ error: "Not found" });
  await ProductZonePrice.destroy({ where: { zoneId: zone.id } });
  await zone.update({ isActive: false });
  res.json({ ok: true });
}

async function getZoneWithPrices(_req, res) {
  try {
    const { sequelize } = require("../config/database");
    const zones = await DeliveryZone.findAll({
      where: { isActive: true },
      include: [{ model: ProductZonePrice, as: "zonePrices" }],
      order: [[sequelize.literal("max_km NULLS LAST"), "ASC"]],
    });
    res.json(zones);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function deleteBrand(req, res) {
  const brand = await Brand.findByPk(req.params.id);
  if (!brand) return res.status(404).json({ error: "Not found" });
  await brand.update({ isActive: false });
  res.json({ ok: true });
}

async function deleteProduct(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: "Not found" });
  await product.update({ isActive: false });
  res.json({ ok: true });
}

module.exports = { getBrands, getProducts, createBrand, updateBrand, createProduct, updateProduct, getZones, updateZone, createZone, deleteZone, getZoneWithPrices, deleteBrand, deleteProduct };
