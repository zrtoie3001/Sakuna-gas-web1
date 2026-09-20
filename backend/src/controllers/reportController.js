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
      where: { createdAt: { [Op.between]: [start, end] }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // ออเดอร์ค้างจากวันอื่น (ก่อนวันนี้ ยังไม่จ่าย ไม่ยกเลิก ย้อนหลังแค่ 30 วัน)
    Order.findAll({
      where: { createdAt: { [Op.between]: [new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000), start] }, status: { [Op.ne]: "cancelled" }, isPaid: false },
      attributes: ["id", "orderNumber", "customerName", "total", "createdAt"],
      order: [["createdAt", "DESC"]],
      raw: true,
    }),
  ]);

  const unpaidOrders = orders.filter(o => !o.isPaid && o.status !== "cancelled");
  const totalExpenses = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);
  const revenue = Number(summary?.revenue || 0);

  // Count gas tanks from all non-cancelled orders (exclude equipment)
  const gasTanks = orders.reduce((sum, o) => {
    const n = o.note || "";
    if (n.match(/^__(?:phone_)?walkin:/)) {
      try {
        const w = JSON.parse(n.replace(/^__(?:phone_)?walkin:/, "").split("\n")[0]);
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

  // Walk-in store orders (note starts with __walkin: but NOT __phone_walkin:)
  const { QueryTypes } = require("sequelize");
  const walkinRows = await sequelize.query(
    `SELECT note, total FROM orders
     WHERE status != 'cancelled'
       AND created_at BETWEEN :start AND :end
       AND note LIKE '__walkin:%'
       AND note NOT LIKE '__phone_walkin:%'`,
    { replacements: { start, end }, type: QueryTypes.SELECT }
  );

  // Parse walkin notes to aggregate by product
  const walkinMap = {};
  let walkinTotal = 0;
  for (const r of walkinRows) {
    walkinTotal += Number(r.total || 0);
    try {
      const w = JSON.parse(r.note.replace(/^__walkin:/, "").split("\n")[0]);
      const items = w.type === "mixed" ? (w.items || []) : [w];
      for (const i of items) {
        if (i.type === "equipment") continue;
        const key = `${i.brandName || ""} ${i.weightKg || ""}kg`.trim();
        if (!walkinMap[key]) walkinMap[key] = { name: key, qty: 0, revenue: 0 };
        walkinMap[key].qty += Number(i.qty) || 1;
        walkinMap[key].revenue += Number(i.total || i.price || r.total || 0);
      }
    } catch {}
  }
  const walkinStats = {
    count: walkinRows.length,
    revenue: walkinTotal,
    breakdown: Object.values(walkinMap).sort((a, b) => b.qty - a.qty),
  };

  res.json({ year, month, daily, topProducts, walkinStats });
}

async function dashboardStats(req, res) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const day7Start  = new Date(); day7Start.setDate(day7Start.getDate() - 6); day7Start.setHours(0,0,0,0);

  const [todaySummary, todayPaidOrders, monthRevenue, totalCustomers, pendingOrders, trend7, allMonthOrders, paymentBreakdown, , todayPayBreakdown, monthPayBreakdown] = await Promise.all([
    Order.findOne({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" } },
      attributes: [[fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      raw: true,
    }),
    Order.findAll({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" } },
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
    // All orders this month for parsing walkin notes (topProducts + brandBreakdown)
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" } },
      attributes: ["note", "qty", "total", "productId", "brandId"],
      include: [
        { model: Product, as: "product", attributes: ["name", "kg"], required: false },
        { model: Brand, as: "brand", attributes: ["name"], required: false },
      ],
      raw: false,
    }),
    // Payment method breakdown (this month) — paid only
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // placeholder (was brandBreakdown — now computed from allMonthOrders)
    Promise.resolve([]),
    // Today payment breakdown (cash vs transfer) — paid only
    Order.findAll({
      where: { createdAt: { [Op.between]: [todayStart, todayEnd] }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
    // Month payment breakdown — paid only
    Order.findAll({
      where: { createdAt: { [Op.gte]: monthStart }, status: { [Op.ne]: "cancelled" }, isPaid: true },
      attributes: ["paymentMethod", [fn("COUNT", col("id")), "count"], [fn("SUM", col("total")), "revenue"]],
      group: ["paymentMethod"],
      raw: true,
    }),
  ]);

  // Compute today's gas tank count (all orders, exclude equipment)
  const todayGasTanks = todayPaidOrders.reduce((sum, o) => {
    const n = o.note || "";
    if (n.match(/^__(?:phone_)?walkin:/)) {
      try {
        const w = JSON.parse(n.replace(/^__(?:phone_)?walkin:/, "").split("\n")[0]);
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

  // Parse all month orders (including walkin notes) for topProducts and brandBreakdown
  const productMap = {};
  const brandMap = {};

  function parseOrderItems(order) {
    const n = order.note || "";
    if (n.match(/^__(?:phone_)?walkin:/)) {
      try {
        const w = JSON.parse(n.replace(/^__(?:phone_)?walkin:/, "").split("\n")[0]);
        if (w.type === "mixed") {
          return (w.items || []).map(i => ({
            productName: `${i.brandName || ""} ${i.weightKg || ""}kg`.trim(),
            brandName: i.brandName || "-",
            qty: Number(i.qty) || 1,
            revenue: Number(i.total || i.price || 0),
          }));
        }
        return [{
          productName: `${w.brandName || ""} ${w.weightKg || ""}kg`.trim(),
          brandName: w.brandName || "-",
          qty: Number(w.qty) || 1,
          revenue: Number(order.total || 0),
        }];
      } catch { return []; }
    }
    if (order.product) {
      return [{
        productName: `${order.product.name || ""} ${order.product.kg || ""}kg`.trim(),
        brandName: order.brand?.name || "-",
        qty: Number(order.qty) || 1,
        revenue: Number(order.total || 0),
      }];
    }
    return [];
  }

  for (const order of allMonthOrders) {
    for (const item of parseOrderItems(order)) {
      if (!productMap[item.productName]) productMap[item.productName] = { name: item.productName, qty: 0, revenue: 0 };
      productMap[item.productName].qty += item.qty;
      productMap[item.productName].revenue += item.revenue;

      if (!brandMap[item.brandName]) brandMap[item.brandName] = { name: item.brandName, count: 0, revenue: 0 };
      brandMap[item.brandName].count += item.qty;
      brandMap[item.brandName].revenue += item.revenue;
    }
  }

  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const brandBreakdown = Object.values(brandMap).sort((a, b) => b.count - a.count);

  res.json({
    today: { orders: parseInt(todaySummary?.count || 0), revenue: Number(todaySummary?.revenue || 0), tanks: todayGasTanks },
    month: { revenue: Number(monthRevenue?.revenue || 0) },
    totalCustomers,
    pendingOrders,
    trend7: trendFilled,
    topProducts,
    paymentBreakdown: paymentBreakdown.map(p => ({ method: p.paymentMethod, count: parseInt(p.count), revenue: Number(p.revenue) })),
    brandBreakdown,
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

async function topCustomers(req, res) {
  const { year = new Date().getFullYear(), month } = req.query;
  const { QueryTypes } = require("sequelize");

  const addrNorm  = `LOWER(REGEXP_REPLACE(TRIM(delivery_address), '\\s+', ' ', 'g'))`;
  const phoneNorm = `LOWER(TRIM(COALESCE(NULLIF(TRIM(customer_phone),''), '')))`;
  const nameNorm  = `LOWER(TRIM(COALESCE(NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน'), '')))`;
  const groupKey  = `${addrNorm} || '|' || ${phoneNorm} || '|' || ${nameNorm}`;

  let dateWhere = `EXTRACT(YEAR FROM created_at) = ${parseInt(year)}`;
  if (month) dateWhere += ` AND EXTRACT(MONTH FROM created_at) = ${parseInt(month)}`;

  const rows = await sequelize.query(
    `SELECT
       MAX(TRIM(delivery_address)) AS address,
       MAX(NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน')) AS name,
       MAX(NULLIF(TRIM(customer_phone),'')) AS phone,
       COUNT(id)::int AS orders,
       SUM(total)::numeric AS revenue
     FROM orders
     WHERE status != 'cancelled'
       AND NULLIF(TRIM(delivery_address),'') IS NOT NULL
       AND NULLIF(NULLIF(TRIM(customer_name),''),'ลูกค้าหน้าร้าน') IS NOT NULL
       AND (note NOT LIKE '__walkin:%' OR note LIKE '__phone_walkin:%')
       AND ${dateWhere}
     GROUP BY ${groupKey}
     ORDER BY SUM(total) DESC
     LIMIT 100`,
    { type: QueryTypes.SELECT }
  );

  res.json(rows.map(r => ({
    name: r.name || r.address || "-",
    phone: r.phone || "",
    address: r.address || "",
    orders: parseInt(r.orders),
    revenue: Number(r.revenue || 0),
  })));
}

module.exports = { dailyReport, monthlyReport, dashboardStats, driverStats, topCustomers };
