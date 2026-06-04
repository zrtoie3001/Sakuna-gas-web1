const line = require("@line/bot-sdk");

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const STATUS_LABELS = {
  pending:            "📋 รับคำสั่งซื้อแล้ว",
  preparing:          "📦 กำลังเตรียมสินค้า",
  out_for_delivery:   "🛵 พนักงานกำลังออกส่ง",
  near_destination:   "📍 ใกล้ถึงปลายทางแล้ว",
  delivered:          "✅ ส่งสำเร็จแล้ว",
  cancelled:          "❌ ยกเลิกคำสั่งซื้อ",
};

async function sendOrderConfirmation(lineUserId, order) {
  const msg = {
    type: "flex",
    altText: `✅ ยืนยันคำสั่งซื้อ #${order.orderNumber}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical",
        backgroundColor: "#1A2B6B",
        contents: [{
          type: "text",
          text: "สกุณาแก๊ส — ยืนยันคำสั่งซื้อ",
          color: "#FFFFFF", weight: "bold", size: "md",
        }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: `#${order.orderNumber}`, weight: "bold", size: "xl", color: "#F47B20" },
          { type: "separator" },
          infoRow("🏷 ยี่ห้อ", order.brand?.name || "-"),
          infoRow("🛢 สินค้า", `${order.product?.name} × ${order.qty} ถัง`),
          infoRow("💰 ยอดรวม", `฿${Number(order.total).toLocaleString()}`),
          infoRow("📍 จัดส่ง", order.deliveryAddress?.slice(0, 60) || "-"),
          infoRow("💳 ชำระ", order.paymentMethod === "cash" ? "เงินสด" : "QR โอน"),
          { type: "separator" },
          { type: "text", text: "⏱ โดยประมาณ 30–60 นาที", size: "sm", color: "#6B7280" },
        ],
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [{
          type: "button", style: "primary", color: "#1A2B6B",
          action: {
            type: "uri", label: "ติดตามคำสั่งซื้อ",
            uri: `${process.env.FRONTEND_URL}/track/${order.id}`,
          },
        }],
      },
    },
  };
  return client.pushMessage({ to: lineUserId, messages: [msg] });
}

async function sendStatusUpdate(lineUserId, order, newStatus, estimatedMins) {
  const label = STATUS_LABELS[newStatus] || newStatus;
  const etaText = estimatedMins ? `\nETA: ประมาณ ${estimatedMins} นาที` : "";
  await client.pushMessage({
    to: lineUserId,
    messages: [{
      type: "text",
      text: `🔔 อัปเดตสถานะออเดอร์ #${order.orderNumber}\n${label}${etaText}`,
    }],
  });
}

async function notifyAdminNewOrder(order) {
  const adminIds = (process.env.LINE_ADMIN_IDS || "").split(",").filter(Boolean);
  const text = `🆕 ออเดอร์ใหม่! #${order.orderNumber}\n${order.product?.name} × ${order.qty}\n฿${Number(order.total).toLocaleString()}\n📍 ${order.deliveryAddress?.slice(0, 50)}`;
  await Promise.all(adminIds.map(id =>
    client.pushMessage({ to: id, messages: [{ type: "text", text }] })
  ));
}

function infoRow(label, value) {
  return {
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#6B7280", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#1A2B6B", flex: 3, wrap: true },
    ],
  };
}

module.exports = { client, sendOrderConfirmation, sendStatusUpdate, notifyAdminNewOrder };
