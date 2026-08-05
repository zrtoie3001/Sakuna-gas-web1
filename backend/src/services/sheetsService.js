const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

function getClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function ensureHeader(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A1:K1",
  });
  const row = res.data.values?.[0];
  if (!row || row[0] !== "วันที่") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["วันที่", "เวลา", "เลขออเดอร์", "ลูกค้า", "เบอร์โทร", "ยี่ห้อ", "สินค้า", "จำนวน", "ยอดรวม", "ชำระ", "สถานะ", "ที่อยู่"]],
      },
    });
  }
}

async function appendOrder(order) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    const sheets = getClient();
    await ensureHeader(sheets);
    const now = new Date(order.createdAt || new Date());
    const dateStr = now.toLocaleDateString("th-TH", { dateStyle: "short", timeZone: "Asia/Bangkok" });
    const timeStr = now.toLocaleTimeString("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A:L",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          dateStr,
          timeStr,
          order.orderNumber || "",
          order.customerName || "",
          order.customerPhone || "",
          order.brand?.name || "",
          order.product?.name || "",
          order.qty || 0,
          Number(order.total) || 0,
          order.paymentMethod === "cash" ? "เงินสด" : "QR โอน",
          order.status || "pending",
          order.deliveryAddress || "",
        ]],
      },
    });
  } catch (e) {
    console.error("Sheets append error:", e.message);
  }
}

async function updateOrderStatus(order) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    const sheets = getClient();
    // Find the row with matching orderNumber
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!C:K",
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === order.orderNumber);
    if (rowIndex < 0) return;
    const sheetRow = rowIndex + 1; // 1-indexed, +1 for header
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Sheet1!K${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[order.status]] },
    });
  } catch (e) {
    console.error("Sheets update error:", e.message);
  }
}

const FIELD_LABEL = { hasGas: "ถังมีแก๊ส", newTank: "ถังใหม่", emptyTank: "ถังเปล่า", damagedTank: "ถังเสีย", heldTank: "ค้างถัง" };

async function appendStockLog(log) {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    const sheets = getClient();
    // ensure header
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'ประวัติสต็อก'!A1:A1" });
    if (!res.data.values?.[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID, range: "'ประวัติสต็อก'!A1", valueInputOption: "RAW",
        requestBody: { values: [["วันที่", "เวลา", "ยี่ห้อ", "น้ำหนัก (kg)", "ประเภทถัง", "ก่อน", "หลัง", "เปลี่ยน", "การกระทำ", "หมายเหตุ"]] },
      });
    }
    const now = new Date();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: "'ประวัติสต็อก'!A:J",
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[
        now.toLocaleDateString("th-TH", { dateStyle: "short", timeZone: "Asia/Bangkok" }),
        now.toLocaleTimeString("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" }),
        log.brandName, Number(log.weightKg),
        FIELD_LABEL[log.field] || log.field,
        log.oldValue, log.newValue, log.delta > 0 ? `+${log.delta}` : log.delta,
        log.action === "refill" ? "เติมแก๊ส" : log.action === "adjust" ? "ปรับสต็อก" : "แก้ไขด้วยตัวเอง",
        log.note || "",
      ]] },
    });
  } catch (e) {
    console.error("Sheets stock log error:", e.message);
  }
}

function rgb(r, g, b) { return { red: r/255, green: g/255, blue: b/255 }; }

async function getSheetId(sheets, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

async function syncStockToSheet() {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    const { GasStock } = require("../models");
    const sheets = getClient();
    const rows = await GasStock.findAll({ order: [["brandName", "ASC"], ["weightKg", "ASC"]] });
    const BRANDS = ["ปตท", "PAP", "เวิลด์", "สยาม", "ยูนิค"];

    const header = ["ยี่ห้อ", "น้ำหนัก (kg)", "ถังมีแก๊ส", "ถังใหม่", "ถังเปล่า", "ถังเสีย", "ค้างถัง", "รวม"];
    const data = rows.map(r => {
      const total = Number(r.hasGas) + Number(r.newTank) + Number(r.emptyTank) + Number(r.damagedTank) + Number(r.heldTank);
      return [r.brandName, Number(r.weightKg), Number(r.hasGas), Number(r.newTank), Number(r.emptyTank), Number(r.damagedTank), Number(r.heldTank), total];
    });

    // write data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: "'สต็อก'!A1",
      valueInputOption: "RAW",
      requestBody: { values: [header, ...data] },
    });

    // data only — no formatting so user's custom format stays intact
  } catch (e) {
    console.error("Sheets stock sync error:", e.message);
  }
}

module.exports = { appendOrder, updateOrderStatus, syncStockToSheet, appendStockLog };
