const { sequelize } = require("../config/database");
const { DataTypes } = require("sequelize");

// ── User (Admin / Driver) ────────────────────────────────────────────────────
const User = sequelize.define("User", {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  email:        { type: DataTypes.STRING(150), unique: true },
  phone:        { type: DataTypes.STRING(20) },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  role:         { type: DataTypes.ENUM("admin", "driver", "both"), defaultValue: "driver" },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
  lastLocation: { type: DataTypes.JSONB },
}, { tableName: "users", underscored: true });

// ── Customer ─────────────────────────────────────────────────────────────────
const Customer = sequelize.define("Customer", {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  lineUserId: { type: DataTypes.STRING(100), unique: true },
  name:       { type: DataTypes.STRING(100) },
  phone:      { type: DataTypes.STRING(20) },
  pictureUrl: { type: DataTypes.TEXT },
  totalOrders:{ type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "customers", underscored: true });

// ── DeliveryAddress ───────────────────────────────────────────────────────────
const DeliveryAddress = sequelize.define("DeliveryAddress", {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerId:  { type: DataTypes.UUID, allowNull: false },
  label:       { type: DataTypes.STRING(50), defaultValue: "บ้าน" },
  address:     { type: DataTypes.TEXT },
  lat:         { type: DataTypes.DECIMAL(10, 7) },
  lng:         { type: DataTypes.DECIMAL(10, 7) },
  isDefault:   { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "delivery_addresses", underscored: true });

// ── Brand ─────────────────────────────────────────────────────────────────────
const Brand = sequelize.define("Brand", {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:      { type: DataTypes.STRING(100), allowNull: false },
  logoUrl:   { type: DataTypes.TEXT },
  color:     { type: DataTypes.STRING(20), defaultValue: "#1A2B6B" },
  bgColor:   { type: DataTypes.STRING(20), defaultValue: "#EEF2FF" },
  isActive:  { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "brands", underscored: true });

// ── Product ───────────────────────────────────────────────────────────────────
const Product = sequelize.define("Product", {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:        { type: DataTypes.STRING(100), allowNull: false },
  kg:          { type: DataTypes.DECIMAL(6, 2) },
  homePrice:   { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  description: { type: DataTypes.TEXT },
  isHot:       { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder:   { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "products", underscored: true });

// ── DeliveryZone ──────────────────────────────────────────────────────────────
const DeliveryZone = sequelize.define("DeliveryZone", {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:         { type: DataTypes.STRING(50) },
  label:        { type: DataTypes.STRING(100) },
  maxKm:        { type: DataTypes.DECIMAL(6, 2) },
  deliveryFee:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  color:        { type: DataTypes.STRING(20) },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
  centerLat:    { type: DataTypes.DECIMAL(10, 7) },
  centerLng:    { type: DataTypes.DECIMAL(10, 7) },
  radiusKm:     { type: DataTypes.DECIMAL(6, 2) },
  minLat:       { type: DataTypes.DECIMAL(10, 7) },
  minLng:       { type: DataTypes.DECIMAL(10, 7) },
  polygonCoords: { type: DataTypes.TEXT },
}, { tableName: "delivery_zones", underscored: true });

// ── ProductZonePrice (ราคาร้านค้าแยกตามโซน) ──────────────────────────────────
const ProductZonePrice = sequelize.define("ProductZonePrice", {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  productId: { type: DataTypes.UUID },
  zoneId:    { type: DataTypes.UUID },
  price:     { type: DataTypes.DECIMAL(10, 2) },
}, { tableName: "product_zone_prices", underscored: true, timestamps: false });

// ── DiscountCode ──────────────────────────────────────────────────────────────
const DiscountCode = sequelize.define("DiscountCode", {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code:         { type: DataTypes.STRING(30), unique: true, allowNull: false },
  type:         { type: DataTypes.ENUM("fixed", "percent"), allowNull: false },
  value:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  minOrderAmount:{ type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  maxUses:      { type: DataTypes.INTEGER },
  usedCount:    { type: DataTypes.INTEGER, defaultValue: 0 },
  expiresAt:    { type: DataTypes.DATE },
  allowedProducts: { type: DataTypes.ARRAY(DataTypes.UUID) },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
  description:  { type: DataTypes.TEXT },
}, { tableName: "discount_codes", underscored: true });

// ── Order ─────────────────────────────────────────────────────────────────────
const Order = sequelize.define("Order", {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  orderNumber:     { type: DataTypes.STRING(20), unique: true },
  customerId:      { type: DataTypes.UUID },
  driverId:        { type: DataTypes.UUID },
  brandId:         { type: DataTypes.UUID },
  productId:       { type: DataTypes.UUID },
  qty:             { type: DataTypes.INTEGER, defaultValue: 1 },
  unitPrice:       { type: DataTypes.DECIMAL(10, 2) },
  subtotal:        { type: DataTypes.DECIMAL(10, 2) },
  deliveryFee:     { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  discountAmount:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(10, 2) },
  discountCodeId:  { type: DataTypes.UUID },
  customerName:    { type: DataTypes.STRING(100) },
  customerPhone:   { type: DataTypes.STRING(20) },
  deliveryAddress: { type: DataTypes.TEXT },
  deliveryLat:     { type: DataTypes.DECIMAL(10, 7) },
  deliveryLng:     { type: DataTypes.DECIMAL(10, 7) },
  distanceKm:      { type: DataTypes.DECIMAL(8, 2) },
  zone:            { type: DataTypes.STRING(10) },
  paymentMethod:   { type: DataTypes.ENUM("cash", "qr", "cod"), defaultValue: "cash" },
  isPaid:          { type: DataTypes.BOOLEAN, defaultValue: false },
  slipUrl:         { type: DataTypes.TEXT },
  note:            { type: DataTypes.TEXT },
  status: {
    type: DataTypes.ENUM("pending", "preparing", "out_for_delivery", "near_destination", "delivered", "cancelled"),
    defaultValue: "pending",
  },
}, { tableName: "orders", underscored: true });

// ── OrderStatusLog ────────────────────────────────────────────────────────────
const OrderStatusLog = sequelize.define("OrderStatusLog", {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  orderId:   { type: DataTypes.UUID },
  status:    { type: DataTypes.STRING(50) },
  note:      { type: DataTypes.TEXT },
  changedBy: { type: DataTypes.UUID },
}, { tableName: "order_status_logs", underscored: true });

// ── Associations ──────────────────────────────────────────────────────────────
Customer.hasMany(DeliveryAddress, { foreignKey: "customerId", as: "addresses" });
DeliveryAddress.belongsTo(Customer, { foreignKey: "customerId" });

Customer.hasMany(Order, { foreignKey: "customerId", as: "orders" });
Order.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Brand.hasMany(Order, { foreignKey: "brandId" });
Order.belongsTo(Brand, { foreignKey: "brandId", as: "brand" });

Product.hasMany(Order, { foreignKey: "productId" });
Order.belongsTo(Product, { foreignKey: "productId", as: "product" });

Product.hasMany(ProductZonePrice, { foreignKey: "productId", as: "zonePrices" });
ProductZonePrice.belongsTo(Product, { foreignKey: "productId", as: "product" });

DeliveryZone.hasMany(ProductZonePrice, { foreignKey: "zoneId", as: "zonePrices" });
ProductZonePrice.belongsTo(DeliveryZone, { foreignKey: "zoneId", as: "zone" });

Order.hasMany(OrderStatusLog, { foreignKey: "orderId", as: "statusLogs" });
OrderStatusLog.belongsTo(Order, { foreignKey: "orderId" });

User.hasMany(Order, { foreignKey: "driverId", as: "deliveries" });
Order.belongsTo(User, { foreignKey: "driverId", as: "driver" });

DiscountCode.hasMany(Order, { foreignKey: "discountCodeId" });
Order.belongsTo(DiscountCode, { foreignKey: "discountCodeId", as: "discountCode" });

// ── GasStock ──────────────────────────────────────────────────────────────────
const GasStock = sequelize.define("GasStock", {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brandName:   { type: DataTypes.STRING(100), allowNull: false },
  weightKg:    { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  hasGas:      { type: DataTypes.INTEGER, defaultValue: 0 },   // ถังมีแก๊ส
  newTank:     { type: DataTypes.INTEGER, defaultValue: 0 },   // ถังใหม่
  emptyTank:   { type: DataTypes.INTEGER, defaultValue: 0 },   // ถังเปล่า
  damagedTank: { type: DataTypes.INTEGER, defaultValue: 0 },   // ถังเสีย
  heldTank:    { type: DataTypes.INTEGER, defaultValue: 0 },   // ค้างถัง
}, { tableName: "gas_stocks", underscored: true });

// ── StoreSetting ──────────────────────────────────────────────────────────────
const StoreSetting = sequelize.define("StoreSetting", {
  id:             { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
  forceClose:     { type: DataTypes.BOOLEAN, defaultValue: false },
  forceOpen:      { type: DataTypes.BOOLEAN, defaultValue: false },
  warningMessage: { type: DataTypes.TEXT, defaultValue: "ร้านค้าจะปิดรับออเดอร์ตั้งแต่เวลา 18:45 น. แต่ลูกค้าสามารถมาเปลี่ยนถังเอง หรือใช้บริการที่หน้าร้านค้าได้ถึง 19:00 น." },
  warningStart:   { type: DataTypes.STRING(5), defaultValue: "18:00" },
}, { tableName: "store_settings", underscored: true });

// ── GasStockLog ───────────────────────────────────────────────────────────────
const GasStockLog = sequelize.define("GasStockLog", {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brandName: { type: DataTypes.STRING(100), allowNull: false },
  weightKg:  { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  field:     { type: DataTypes.STRING(50) },   // hasGas / newTank / emptyTank / damagedTank / heldTank / all
  oldValue:  { type: DataTypes.INTEGER },
  newValue:  { type: DataTypes.INTEGER },
  delta:     { type: DataTypes.INTEGER },
  action:    { type: DataTypes.STRING(50) },   // adjust / refill / manual
  note:      { type: DataTypes.TEXT },
}, { tableName: "gas_stock_logs", underscored: true });

// ── GasRefill ─────────────────────────────────────────────────────────────────
const GasRefill = sequelize.define("GasRefill", {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  brandName:   { type: DataTypes.STRING(100), allowNull: false },
  weightKg:    { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  qty:         { type: DataTypes.INTEGER, allowNull: false },
  costPerUnit: { type: DataTypes.DECIMAL(10, 2) },
  totalCost:   { type: DataTypes.DECIMAL(10, 2) },
  note:        { type: DataTypes.TEXT },
}, { tableName: "gas_refills", underscored: true });

// ── Equipment ─────────────────────────────────────────────────────────────────
const Equipment = sequelize.define("Equipment", {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  price:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  qty:         { type: DataTypes.INTEGER, defaultValue: 0 },
  description: { type: DataTypes.TEXT },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true },
  category:    { type: DataTypes.STRING(20), defaultValue: "equipment" }, // equipment | stove
}, { tableName: "equipments", underscored: true });

// ── EquipmentSale ─────────────────────────────────────────────────────────────
const EquipmentSale = sequelize.define("EquipmentSale", {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  equipmentId:  { type: DataTypes.UUID, allowNull: false },
  qty:          { type: DataTypes.INTEGER, allowNull: false },
  salePrice:    { type: DataTypes.DECIMAL(10, 2) },
  note:         { type: DataTypes.TEXT },
}, { tableName: "equipment_sales", underscored: true });

Equipment.hasMany(EquipmentSale, { foreignKey: "equipmentId", as: "sales" });
EquipmentSale.belongsTo(Equipment, { foreignKey: "equipmentId", as: "equipment" });

// ── Debt (ค้างเงิน / ค้างถัง) ─────────────────────────────────────────────────
const Debt = sequelize.define("Debt", {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  customerName:   { type: DataTypes.STRING(100), allowNull: false },
  customerPhone:  { type: DataTypes.STRING(20) },
  type:           { type: DataTypes.ENUM("money", "tank", "both"), allowNull: false },
  amount:         { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  tankQty:        { type: DataTypes.INTEGER, defaultValue: 0 },
  tankDesc:       { type: DataTypes.STRING(100) },
  note:           { type: DataTypes.TEXT },
  isPaid:         { type: DataTypes.BOOLEAN, defaultValue: false },
  paidAt:         { type: DataTypes.DATE },
  tankReturned:   { type: DataTypes.BOOLEAN, defaultValue: false },
  tankReturnedAt: { type: DataTypes.DATE },
  orderId:        { type: DataTypes.UUID },
}, { tableName: "debts", underscored: true });

module.exports = {
  sequelize,
  User,
  Customer,
  DeliveryAddress,
  Brand,
  Product,
  DeliveryZone,
  ProductZonePrice,
  DiscountCode,
  Order,
  OrderStatusLog,
  StoreSetting,
  GasStock,
  GasStockLog,
  GasRefill,
  Equipment,
  EquipmentSale,
  Debt,
};
