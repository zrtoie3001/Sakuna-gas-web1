import { useState, useEffect, useCallback } from "react";
import api from "../utils/api.js";
import qrBase64 from "../assets/qrBase64.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const STATUSES = [
  { key: "",                  label: "ทั้งหมด" },
  { key: "pending",           label: "รอรับงาน",       bg: "#FEF3C7", color: "#92400E" },
  { key: "preparing",         label: "เตรียมสินค้า",   bg: "#DBEAFE", color: "#1E40AF" },
  { key: "out_for_delivery",  label: "กำลังส่ง",       bg: "#E0F2FE", color: "#075985" },
  { key: "near_destination",  label: "ใกล้ถึง",        bg: "#D1FAE5", color: "#065F46" },
  { key: "delivered",         label: "ส่งสำเร็จ",      bg: "#D1FAE5", color: "#065F46" },
  { key: "cancelled",         label: "ยกเลิก",         bg: "#FEE2E2", color: "#991B1B" },
];

export default function Orders() {
  const [orders, setOrders]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatus] = useState("");
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetch = useCallback(async () => {
    const params = new URLSearchParams({ page, limit: 20 });
    if (statusFilter) params.set("status", statusFilter);
    if (date) params.set("date", date);
    const r = await api.get(`/api/v1/orders?${params}`);
    setOrders(r.data.orders);
    setTotal(r.data.total);
  }, [page, statusFilter, date]);

  useEffect(() => { fetch(); }, [fetch]);

  function printReceipt(o) {
    const dateStr = new Date(o.createdAt).toLocaleDateString("th-TH", { dateStyle: "short" });
    const timeStr = new Date(o.createdAt).toLocaleTimeString("th-TH", { timeStyle: "short" });
    const pay     = o.paymentMethod === "cash" ? "เงินสด" : "โอน QR";
    const discount  = Number(o.discountAmount || 0);
    const subtotal  = Number(o.total) + discount;
    const qrDataUrl = qrBase64;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>ใบเสร็จ ${o.orderNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; width: 80mm; padding: 6px 8px 12px; font-size: 14px; color: #000; }
  .center { text-align: center; }
  .bold   { font-weight: 800; }
  .divider-solid { border-top: 1.5px solid #000; margin: 5px 0; }
  .divider-dash  { border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 12px; font-weight: 800; padding: 3px 2px; border-bottom: 1px solid #000; }
  td { font-size: 13px; padding: 3px 2px; vertical-align: top; }
  .col-item { width: 52%; }
  .col-qty  { width: 12%; text-align: center; }
  .col-unit { width: 18%; text-align: right; }
  .col-amt  { width: 18%; text-align: right; }
  .info { font-size: 12px; line-height: 1.7; }
  .qr-section { display: flex; justify-content: center; margin-top: 8px; }
  .qr-section img { width: 52mm; height: 52mm; object-fit: contain; }
  @media print { body { margin:0; } @page { margin: 0; size: 80mm auto; } }
</style></head><body>
<div class="center bold" style="font-size:18px; letter-spacing:1px;">สกุณาแก๊ส</div>
<div class="center" style="font-size:11px;">39 ซอยพหลโยธิน 48 แขวงท่าแร้ง เขตบางเขน กทม. 10220</div>
<div class="center" style="font-size:12px;">097-121-3054 | 092-631-4331 | 02-970-9385</div>
<div class="divider-solid" style="margin-top:6px;"></div>

<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
  <span>เลขที่: <span class="bold">${o.orderNumber}</span></span>
  <span>${dateStr} ${timeStr}</span>
</div>
<div class="divider-dash"></div>

<table>
  <thead>
    <tr>
      <th class="col-item" style="text-align:left;">รายการ</th>
      <th class="col-qty">จำนวน</th>
      <th class="col-unit">ราคา/ถัง</th>
      <th class="col-amt">รวม</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="col-item">${o.brand?.name || ""} ${o.product?.name || ""}</td>
      <td class="col-qty" style="text-align:center;">${o.qty}</td>
      <td class="col-unit" style="text-align:right;">${o.qty > 0 ? Number(Math.round(subtotal / o.qty)).toLocaleString() : "-"}</td>
      <td class="col-amt" style="text-align:right;">${subtotal.toLocaleString()}</td>
    </tr>
  </tbody>
</table>
<div class="divider-solid"></div>

<table style="font-size:13px;">
  ${discount > 0 ? `
  <tr>
    <td>ราคาก่อนลด</td>
    <td style="text-align:right;">${subtotal.toLocaleString()} บาท</td>
  </tr>
  <tr>
    <td>ส่วนลด${o.discountCode ? ` (${o.discountCode})` : ""}</td>
    <td style="text-align:right;">-${discount.toLocaleString()} บาท</td>
  </tr>
  <tr><td colspan="2"><div class="divider-dash" style="margin:3px 0;"></div></td></tr>` : ""}
  <tr>
    <td style="font-size:15px; font-weight:800;">ยอดรวมชำระ</td>
    <td style="text-align:right; font-size:15px; font-weight:800;">${Number(o.total).toLocaleString()} บาท</td>
  </tr>
</table>
<div class="divider-dash"></div>

<div class="info">
  <div>ลูกค้า: <span class="bold">ลูกค้า</span></div>
  <div>โทร: ${o.customerPhone || "-"}</div>
  <div>ที่อยู่: ${o.deliveryAddress || "-"}</div>
  <div>ชำระ: ${pay}</div>
  ${o.note ? `<div>หมายเหตุ: ${o.note}</div>` : ""}
</div>
<div class="divider-dash"></div>

<div class="qr-section">
  <img src="${qrDataUrl}" alt="QR PromptPay" />
</div>
<div class="center" style="font-size:11px; font-weight:700; margin-top:3px;">สแกนโอนเงิน PromptPay</div>
<div class="center" style="font-size:11px; margin-top:2px;">นาง รุจิรา ดวงเพ็ชรแสง (KBank)</div>
<div class="divider-dash" style="margin-top:6px;"></div>
<div class="center" style="font-size:12px; margin-top:4px;">ขอบคุณที่ใช้บริการค่ะ</div>

<script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }</script>
</body></html>`;
    const w = window.open("", "_blank", "width=420,height=700");
    w.document.write(html);
    w.document.close();
  }

  async function updateStatus(orderId, status) {
    setUpdating(true);
    await api.put(`/api/v1/orders/${orderId}/status`, { status });
    setUpdating(false);
    fetch();
    if (selected?.id === orderId) setSelected(s => ({ ...s, status }));
  }

  const st = (key) => STATUSES.find(s => s.key === key) || STATUSES[0];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Left: List */}
      <div style={{ flex: "1 1 500px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>📦 ออเดอร์</h1>
          <span style={{ marginLeft: "auto", fontSize: 13, color: GRAY }}>{total} รายการ</span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }} />
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }}>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          {orders.map(o => {
            const s = st(o.status);
            return (
              <div key={o.id} onClick={() => setSelected(o)} style={{
                padding: "12px 16px", borderBottom: "1px solid #F3F4F6",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: selected?.id === o.id ? "#EEF2FF" : WHITE,
                transition: "background .1s",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 11, background: s.bg, color: s.color, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: NAVY }}>{o.customerName} · {o.customerPhone}</p>
                  <p style={{ fontSize: 12, color: GRAY }}>{o.product?.name} ×{o.qty} · ฿{Number(o.total).toLocaleString()}</p>
                </div>
                <div style={{ fontSize: 11, color: GRAY, textAlign: "right", flexShrink: 0 }}>
                  {new Date(o.createdAt).toLocaleTimeString("th-TH", { timeStyle: "short" })}
                </div>
              </div>
            );
          })}
          {!orders.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ไม่พบออเดอร์</p>}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY }}>←</button>
          <span style={{ padding: "6px 10px", fontSize: 13, color: GRAY }}>หน้า {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY }}>→</button>
        </div>
      </div>

      {/* Right: Detail */}
      {selected && (
        <div style={{ flex: "0 0 320px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", alignSelf: "flex-start", position: "sticky", top: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{selected.orderNumber}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => printReceipt(selected)} style={{
                padding: "6px 12px", borderRadius: 8, border: `2px solid ${NAVY}`,
                background: WHITE, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>🖨 ปริ้น</button>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>
          </div>

          {[
            ["🏷 ยี่ห้อ",   selected.brand?.name],
            ["🛢 สินค้า",   `${selected.product?.name} ×${selected.qty}`],
            ["👤 ลูกค้า",   selected.customerName],
            ["📞 โทร",      selected.customerPhone],
            ["📍 ที่อยู่",  selected.deliveryAddress],
            ["💰 ยอดรวม",  `฿${Number(selected.total).toLocaleString()}`],
            ["💳 ชำระ",    selected.paymentMethod === "cash" ? "เงินสด" : "QR โอน"],
            ["📏 ระยะทาง", selected.distanceKm ? `${Number(selected.distanceKm).toFixed(1)} กม.` : "-"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
              <span style={{ color: GRAY, flexShrink: 0, width: 80 }}>{k}</span>
              <span style={{ color: NAVY, wordBreak: "break-word" }}>{v || "-"}</span>
            </div>
          ))}

          {selected.note && (
            <div style={{ marginTop: 10, background: "#FFF7ED", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E" }}>
              💬 {selected.note}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>อัปเดตสถานะ</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUSES.filter(s => s.key && s.key !== "cancelled").map(s => (
                <button key={s.key} onClick={() => updateStatus(selected.id, s.key)}
                  disabled={updating || selected.status === s.key}
                  style={{
                    padding: "6px 10px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: selected.status === s.key ? s.bg || "#E5E7EB" : "#F3F4F6",
                    color: selected.status === s.key ? s.color || NAVY : GRAY,
                    opacity: updating ? 0.6 : 1,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
