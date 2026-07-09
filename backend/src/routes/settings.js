const router = require("express").Router();
const { StoreSetting } = require("../models");
const { requireAuth, requireRole } = require("../middleware/auth");

async function getSetting() {
  let s = await StoreSetting.findByPk(1);
  if (!s) s = await StoreSetting.create({ id: 1 });
  return s;
}

// Public — customer app reads this
router.get("/store", async (_req, res) => {
  const s = await getSetting();
  res.json(s);
});

// Admin only
router.put("/store", requireAuth, requireRole("admin"), async (req, res) => {
  const s = await getSetting();
  await s.update(req.body);
  res.json(s);
});

// Test Google Sheets connection
router.get("/test-sheets", requireAuth, async (_req, res) => {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const SA_JSON  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!SHEET_ID) return res.json({ ok: false, error: "ไม่มี GOOGLE_SHEET_ID ใน Railway" });
  if (!SA_JSON)  return res.json({ ok: false, error: "ไม่มี GOOGLE_SERVICE_ACCOUNT_JSON ใน Railway" });

  let creds;
  try { creds = JSON.parse(SA_JSON); } catch {
    return res.json({ ok: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON parse ไม่ได้ — JSON ผิดรูปแบบ" });
  }

  if (!creds.client_email) return res.json({ ok: false, error: "ไม่มี client_email ใน JSON" });
  if (!creds.private_key)  return res.json({ ok: false, error: "ไม่มี private_key ใน JSON" });

  try {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth });
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "Sheet1!A1:A1" });
    return res.json({
      ok: true,
      message: "เชื่อมต่อ Google Sheets สำเร็จ ✅",
      sheetId: SHEET_ID,
      clientEmail: creds.client_email,
      cell_A1: r.data.values?.[0]?.[0] || "(ว่าง)",
    });
  } catch (e) {
    return res.json({
      ok: false,
      error: e.message,
      sheetId: SHEET_ID,
      clientEmail: creds.client_email,
      hint: e.message.includes("403") ? "Sheet ยังไม่ได้ Share ให้ service account หรือไม่มีสิทธิ์ Editor"
          : e.message.includes("404") ? "ไม่พบ Sheet — GOOGLE_SHEET_ID อาจผิด"
          : e.message.includes("401") || e.message.includes("invalid_grant") ? "credentials ผิด — private_key หรือ client_email อาจไม่ถูกต้อง"
          : "ดู error ด้านบน",
    });
  }
});

module.exports = router;
