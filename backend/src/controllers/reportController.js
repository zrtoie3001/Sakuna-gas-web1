const { Op, fn, col, literal } = require("sequelize");
const { Order, Product, Brand, Customer, User, Expense, sequelize } = require("../models");

async function dailyReport(req, res) {
  const { date = new Date().toISOString().split("T")[0] } = req.query;
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const [orders, summary, expenseRows, payBreakdown, overdueOrders] = await Promise.all([
    Order.findAll({
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
      include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
      order: [["createdAt", "DESC"]],
    }),
    Order.findOne({
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: [
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("total")), "revenue"],
        [fn("SUM", col("qty")), "units"],
      ],
      raw: true,
    }),
    Expense ? Expense.findAll({
      where: { createdAt: { [Op.between]: [start, end] } },
      attributes: ["amount", "type", "description", "createdByName"],
      raw: true,
    }).catch(() => []) : Promise.resolve([]),
    Order.findAll({
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" } },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // ออเดอร์ค้างจากวันอื่น (ก่อนวันนี้ ยังไม่จ่าย ไม่ยกเลิก)
    Order.findAll({
      where: { createdAt: { [Op.lt]: start }, status: { [Op.ne]: "cancelled" }, isPaid: false },
      attributes: ["id", "orderNumber", "customerName", "total", "createdAt"],
      order: [["createdAt", "DESC"]],
      raw: true,
    }),
  ]);

  const unpaidOrders = orders.filter(o => !o.isPaid && o.status !== "cancelled");
  const totalExpenses = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
  const revenue = Number(summary?.revenue || 0);

  // Count only gas tanks (exclude equipment) from paid orders
  const gasTanks = orders.filter(o => o.isPaid).reduce((sum, o) => {
    const n = o.note || "";
    if (n.startsWith("__walkin:")) {
      try {
        const w = JSON.parse(n.replace(/^__walkin:/, "").split("\n")[0]);
        if (w.type === "mixed") return sum + (w.items || []).filter(i => i.type === "gas" || i.type === "new_tank").reduce((s, i) => s + (Number(i.qty) || 1), 0);
        if (w.type === "gas" || w.type === "new_tank") return sum + (Number(w.qty) || 1);
        return sum; // equipment
      } catch { return sum; }
    }
    return o.productId ? sum + (Number(o.qty) || 0) : sum;
  }, 0);

  res.json({ date, orders, summary: { ...summary, gasTanks }, expenses: expenseRows, totalExpenses, netRevenue: revenue - totalExpenses, unpaidOrders: unpaidOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, total: o.total })), overdueOrders: overdueOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, total: Number(o.total), createdAt: o.createdAt })), payBreakdown: payBreakdown.map(p => ({ method: p.paymentMethod, count: parseInt(p.count), revenue: Number(p.revenue) })) });
}

async function monthlyReport(req, res) {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  const daily = await Order.findAll({
    where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" }, isPaid: true },
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
  const day7Start  = new Date(); day7Start.setDate(day7Start.getDate() - 6); day7Start.setHours(0,0,0,0);

  const [todaySummary, todayPaidOrders, monthRevenue, totalCustomers, pendingOrders, trend7, topProducts, paymentBreakdown, brandBreakdown, todayPayBreakdown, monthPayBreakdown] = await Promise.all([
    Order.findOne({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      raw: true,
    }),
    Order.findAll({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: ["note", "qty", "productId"],
      raw: true,
    }),
    Order.findOne({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("SUM", col("total")), "revenue"]],
      raw: true,
    }),
    Customer.count(),
    Order.count({ where: { status: "pending" } }),
    // 7-day trend
    Order.findAll({
      where: { createdAt: { [Op.between]: [day7Start, todayEnd] }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("DATE", col("created_at")), "date"], [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"], [fn("SUM", col("qty")), "tanks"]],
      group: [fn("DATE", col("created_at"))],
      order: [[literal("date"), "ASC"]],
      raw: true,
    }),
    // Top products (this month)
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: ["productId", [fn("SUM", col("qty")), "totalQty"], [fn("SUM", col("total")), "revenue"]],
      include: [{ model: Product, as: "product", attributes: ["name", "kg"] }],
      group: ["productId", "product.id"],
      order: [[literal("\"totalQty\""), "DESC"]],
      limit: 5,
      raw: false,
    }),
    // Payment method breakdown (this month)
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // Brand breakdown (this month)
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: ["brandId", [fn("COUNT", col("Order.id")), "count"], [fn("SUM", col("total")), "revenue"]],
      include: [{ model: Brand, as: "brand", attributes: ["name"] }],
      group: ["brandId", "brand.id"],
      order: [[literal("count"), "DESC"]],
      raw: false,
    }),
    // Today payment breakdown (cash vs transfer)
    Order.findAll({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" } },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // Month payment breakdown
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
  ]);

  // Compute today's gas tank count (paid only, exclude equipment)
  const todayGasTanks = todayPaidOrders.reduce((sum, o) => {
    const n = o.note || "";
    if (n.startsWith("__walkin:")) {
      try {
        const w = JSON.parse(n.replace(/^__walkin:/, "").split("\n")[0]);
        if (w.type === "mixed") return sum + (w.items || []).filter(i => i.type === "gas" || i.type === "new_tank").reduce((s, i) => s + (Number(i.qty) || 1), 0);
        if (w.type === "gas" || w.type === "new_tank") return sum + (Number(w.qty) || 1);
        return sum;
      } catch { return sum; }
    }
    return o.productId ? sum + (Number(o.qty) || 0) : sum;
  }, 0);

  // Fill missing days in trend
  const trendMap = {};
  trend7.forEach(r => { trendMap[r.date] = r; });
  const trendFilled = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    trendFilled.push({ date: key, count: parseInt(trendMap[key]?.count || 0), revenue: Number(trendMap[key]?.revenue || 0), tanks: parseInt(trendMap[key]?.tanks || 0) });
  }

  res.json({
    today: { orders: parseInt(todaySummary?.count || 0), revenue: Number(todaySummary?.revenue || 0), tanks: todayGasTanks },
    month: { revenue: Number(monthRevenue?.revenue || 0) },
    totalCustomers,
    pendingOrders,
    trend7: trendFilled,
    topProducts: topProducts.map(p => ({ name: p.product?.name || "-", qty: parseInt(p.dataValues.totalQty || 0), revenue: Number(p.dataValues.revenue || 0) })),
    paymentBreakdown: paymentBreakdown.map(p => ({ method: p.paymentMethod, count: parseInt(p.count), revenue: Number(p.revenue) })),
    brandBreakdown: brandBreakdown.map(b => ({ name: b.brand?.name || "-", count: parseInt(b.dataValues.count || 0), revenue: Number(b.dataValues.revenue || 0) })),
    todayPayBreakdown: todayPayBreakdown.map(p => ({ method: p.paymentMethod, count: parseInt(p.count), revenue: Number(p.revenue) })),
    monthPayBreakdown: monthPayBreakdown.map(p => ({ method: p.paymentMethod, count: parseInt(p.count), revenue: Number(p.revenue) })),
  });
}

async function driverStats(req, res) {
  const { date = new Date().toISOString().split("T")[0] } = req.query;
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const rows = await Order.findAll({
    where: { createdAt: { [Op.between]: [start, end] }, status: "delivered", driverId: { [Op.ne]: null } },
    attributes: ["driverId", [fn("COUNT", col("Order.id")), "orders"], [fn("SUM", col("qty")), "tanks"]],
    include: [{ model: User, as: "driver", attributes: ["name"] }],
    group: ["driverId", "driver.id"],
    order: [[literal('"tanks"'), "DESC"]],
    raw: false,
  });

  res.json({
    date,
    drivers: rows.map(r => ({
      name: r.driver?.name || "-",
      orders: parseInt(r.dataValues.orders || 0),
      tanks: parseInt(r.dataValues.tanks || 0),
    })),
  });
}

module.exports = { dailyReport, monthlyReport, dashboardStats, driverStats };
