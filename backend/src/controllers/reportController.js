const { Op, fn, col, literal } = require("sequelize");
const { Order, Product, Brand, Customer, sequelize } = require("../models");

async function dailyReport(req, res) {
  const { date = new Date().toISOString().split("T")[0] } = req.query;
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const [orders, summary] = await Promise.all([
    Order.findAll({
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
      include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
      order: [["createdAt", "DESC"]],
    }),
    Order.findOne({
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
      attributes: [
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("total")), "revenue"],
        [fn("SUM", col("qty")), "units"],
      ],
      raw: true,
    }),
  ]);

  res.json({ date, orders, summary });
}

async function monthlyReport(req, res) {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  const daily = await Order.findAll({
    where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
    attributes: [
      [fn("DATE", col("created_at")), "date"],
      [fn("COUNT", col("id")), "count"],
      [fn("SUM", col("total")), "revenue"],
    ],
    group: [fn("DATE", col("created_at"))],
    order: [[literal("date"), "ASC"]],
    raw: true,
  });

  const topProducts = await Order.findAll({
    where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
    attributes: ["productId", [fn("COUNT", col("Order.id")), "count"], [fn("SUM", col("total")), "revenue"]],
    include: [{ model: Product, as: "product", attributes: ["name", "kg"] }],
    group: ["productId", "product.id"],
    order: [[literal("count"), "DESC"]],
    limit: 5,
    raw: false,
  });

  res.json({ year, month, daily, topProducts });
}

async function dashboardStats(req, res) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [todaySummary, monthRevenue, totalCustomers, pendingOrders] = await Promise.all([
    Order.findOne({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      raw: true,
    }),
    Order.findOne({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("SUM", col("total")), "revenue"]],
      raw: true,
    }),
    Customer.count(),
    Order.count({ where: { status: "pending" } }),
  ]);

  res.json({
    today: { orders: parseInt(todaySummary?.count || 0), revenue: Number(todaySummary?.revenue || 0) },
    month: { revenue: Number(monthRevenue?.revenue || 0) },
    totalCustomers,
    pendingOrders,
  });
}

module.exports = { dailyReport, monthlyReport, dashboardStats };
