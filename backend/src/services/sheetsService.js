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
    const dateStr = now.toLocaleDateString("th-TH", { dateStyle: "short" });
    const timeStr = now.toLocaleTimeString("th-TH", { timeStyle: "short" });
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

async function syncStockToSheet() {
  if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  try {
    const { GasStock } = require("../models");
    const sheets = getClient();
    const rows = await GasStock.findAll({ order: [["brandName", "ASC"], ["weightKg", "ASC"]] });
    const header = ["ยี่ห้อ", "น้ำหนัก (kg)", "ถังมีแก๊ส", "ถังใหม่", "ถังเปล่า", "ถังเสีย", "ค้างถัง", "รวม"];
    const data = rows.map(r => {
      const total = Number(r.hasGas) + Number(r.newTank) + Number(r.emptyTank) + Number(r.damagedTank) + Number(r.heldTank);
      return [r.brandName, Number(r.weightKg), r.hasGas, r.newTank, r.emptyTank, r.damagedTank, r.heldTank, total];
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "สต็อก!A1",
      valueInputOption: "RAW",
      requestBody: { values: [header, ...data] },
    });
  } catch (e) {
    console.error("Sheets stock sync error:", e.message);
  }
}

module.exports = { appendOrder, updateOrderStatus, syncStockToSheet };
