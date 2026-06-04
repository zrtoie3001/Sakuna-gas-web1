import { useState, useEffect, useCallback } from "react";
import api from "../utils/api.js";

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
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{selected.orderNumber}</h2>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
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
