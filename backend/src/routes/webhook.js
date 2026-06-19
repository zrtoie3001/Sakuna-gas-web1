const router = require("express").Router();
const line = require("@line/bot-sdk");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");

const middleware = line.middleware({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const LIFF_URL = `https://liff.line.me/${process.env.LINE_LIFF_ID}`;

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
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim().toLowerCase();
  const replyToken = event.replyToken;

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
