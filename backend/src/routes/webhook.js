const router = require("express").Router();
const line = require("@line/bot-sdk");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");
const { Order, Brand, Product } = require("../models");

const middleware = line.middleware({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const LIFF_URL = `https://liff.line.me/${process.env.LINE_LIFF_ID}`;

const STATUS_LABELS = {
  pending:            { text: "⏳ รอรับงาน",            detail: "ร้านกำลังรับออเดอร์ของคุณค่ะ" },
  preparing:          { text: "📦 เตรียมสินค้า",         detail: "กำลังเตรียมแก๊สให้คุณค่ะ" },
  out_for_delivery:   { text: "🛵 กำลังส่ง",             detail: "พนักงานออกส่งแล้วค่ะ จะถึงเร็วๆ นี้!" },
  near_destination:   { text: "📍 ใกล้ถึงแล้ว",          detail: "อีกไม่นานพนักงานจะถึงบ้านคุณแล้วค่ะ" },
  delivered:          { text: "✅ ส่งสำเร็จแล้ว",        detail: "ได้รับแก๊สเรียบร้อยแล้วค่ะ ขอบคุณที่ใช้บริการ!" },
  cancelled:          { text: "❌ ยกเลิกคำสั่งซื้อ",    detail: "คำสั่งซื้อถูกยกเลิกแล้วค่ะ" },
};

router.post("/", middleware, async (req, res) => {
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

router.post("/line", middleware, async (req, res) => {
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  // Handle postback (tracking button)
  if (event.type === "postback") {
    const params = new URLSearchParams(event.postback.data);
    if (params.get("action") === "track") {
      const orderId = params.get("orderId");
      const order = await Order.findByPk(orderId, {
        include: [{ model: Brand, as: "brand" }, { model: Product, as: "product" }],
      }).catch(() => null);
      if (!order) return client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "ไม่พบออเดอร์นี้ค่ะ" }] });
      const st = STATUS_LABELS[order.status] || { text: order.status, detail: "" };
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: "flex",
          altText: `สถานะออเดอร์ #${order.orderNumber}: ${st.text}`,
          contents: {
            type: "bubble",
            header: {
              type: "box", layout: "vertical", backgroundColor: "#1A2B6B",
              contents: [{ type: "text", text: "สกุณาแก๊ส — สถานะออเดอร์", color: "#FFFFFF", weight: "bold", size: "md" }],
            },
            body: {
              type: "box", layout: "vertical", spacing: "md",
              contents: [
                { type: "text", text: `#${order.orderNumber}`, weight: "bold", size: "xl", color: "#F47B20" },
                { type: "separator" },
                { type: "text", text: st.text, weight: "bold", size: "lg", color: "#1A2B6B" },
                { type: "text", text: st.detail, size: "sm", color: "#6B7280", wrap: true },
                { type: "separator" },
                { type: "text", text: `${order.brand?.name || ""} ${order.product?.name || ""} × ${order.qty} ถัง`, size: "sm", color: "#374151" },
                { type: "text", text: `฿${Number(order.total).toLocaleString()}`, size: "sm", color: "#374151" },
              ],
            },
            footer: {
              type: "box", layout: "vertical",
              contents: [{
                type: "button", style: "primary", color: "#1A2B6B",
                action: { type: "postback", label: "🔄 รีเฟรชสถานะ", data: `action=track&orderId=${order.id}`, displayText: "ติดตามสถานะออเดอร์" },
              }],
            },
          },
        }],
      });
    }
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim().toLowerCase();
  const replyToken = event.replyToken;

  if (["ติดต่อ", "ติดต่อร้าน", "เบอร์", "โทร"].some(k => text.includes(k))) {
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "flex",
        altText: "ติดต่อสกุณาแก๊ส",
        contents: {
          type: "bubble",
          body: {
            type: "box", layout: "vertical", spacing: "md",
            contents: [
              { type: "text", text: "📞 ติดต่อสกุณาแก๊ส", weight: "bold", size: "lg", color: "#1A2B6B" },
              { type: "separator" },
              { type: "button", action: { type: "uri", label: "📱 097-121-3054", uri: "tel:0971213054" }, style: "secondary", margin: "md" },
              { type: "button", action: { type: "uri", label: "📱 092-631-4331", uri: "tel:0926314331" }, style: "secondary", margin: "sm" },
              { type: "button", action: { type: "uri", label: "☎️ 02-970-9385", uri: "tel:029709385" }, style: "secondary", margin: "sm" },
            ],
          },
        },
      }],
    });
  }

  if (["สั่ง", "สั่งแก๊ส", "order", "ออเดอร์", "สวัสดี", "hello", "hi"].some(k => text.includes(k))) {
    const open = isOpen();
    if (!open) {
      return client.replyMessage({
        replyToken,
        messages: [{
          type: "text",
          text: `⏰ ขณะนี้ร้านสกุณาแก๊สปิดทำการแล้วค่ะ\n\nจะเปิดอีกครั้ง${getNextOpenTime()}\n\nหากต้องการสั่งล่วงหน้าสามารถกดสั่งได้เลยค่ะ ทางร้านจะติดต่อกลับในเวลาทำการ`,
        }, {
          type: "template",
          altText: "สั่งแก๊สออนไลน์",
          template: {
            type: "buttons",
            text: "สั่งแก๊สสกุณาแก๊ส",
            actions: [{ type: "uri", label: "🛵 สั่งแก๊สเลย", uri: LIFF_URL }],
          },
        }],
      });
    }

    return client.replyMessage({
      replyToken,
      messages: [{
        type: "flex",
        altText: "สั่งแก๊สสกุณาแก๊ส",
        contents: {
          type: "bubble",
          hero: { type: "image", url: "https://via.placeholder.com/800x400?text=Sakunna+Gas", size: "full", aspectRatio: "20:9", aspectMode: "cover" },
          body: {
            type: "box", layout: "vertical", spacing: "sm",
            contents: [
              { type: "text", text: "🔥 สกุณาแก๊ส", weight: "bold", size: "xl", color: "#1A2B6B" },
              { type: "text", text: "สั่งง่าย จ่ายสะดวก ส่งไว", size: "sm", color: "#6B7280" },
              { type: "separator" },
              { type: "text", text: "📦 ปตท. · PAP · เวิลด์ · ยูนิค · สยาม", size: "sm" },
              { type: "text", text: "💰 ถัง 4 กก. เริ่ม 200 บาท", size: "sm" },
              { type: "text", text: "🕐 จันทร์–เสาร์ 07:00–19:00 | อาทิตย์ 07:00–13:00", size: "xs", color: "#6B7280", wrap: true },
            ],
          },
          footer: {
            type: "box", layout: "vertical",
            contents: [{
              type: "button", style: "primary", color: "#1A2B6B",
              action: { type: "uri", label: "🛵 สั่งแก๊สเลย!", uri: LIFF_URL },
            }],
          },
        },
      }],
    });
  }
}

module.exports = router;
