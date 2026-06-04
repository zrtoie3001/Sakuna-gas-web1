import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

export default function Reports() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [daily, setDaily] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [date, setDate]   = useState(now.toISOString().split("T")[0]);
  const [dayOrders, setDayOrders] = useState([]);

  useEffect(() => {
    api.get(`/api/v1/reports/monthly?year=${year}&month=${month}`).then(r => {
      setDaily(r.data.daily || []);
      setTopProducts(r.data.topProducts || []);
    }).catch(() => {});
  }, [year, month]);

  useEffect(() => {
    api.get(`/api/v1/reports/daily?date=${date}`).then(r => setDayOrders(r.data.orders || [])).catch(() => {});
  }, [date]);

  function exportCSV() {
    const rows = [["เลขออเดอร์", "ลูกค้า", "สินค้า", "จำนวน", "ยอดรวม", "สถานะ", "วันที่"]];
    dayOrders.forEach(o => rows.push([o.orderNumber, o.customerName, o.product?.name, o.qty, o.total, o.status, new Date(o.createdAt).toLocaleString("th-TH")]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `orders_${date}.csv`; a.click();
  }

  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 20 }}>📈 รายงาน</h1>

      {/* Monthly Chart */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>ยอดขายรายวัน</h2>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }}>
            {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d?.slice(8)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`฿${Number(v).toLocaleString()}`, "ยอดขาย"]} />
            <Bar dataKey="revenue" fill={ORANGE} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 12 }}>สินค้าขายดี</h2>
          {topProducts.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: [ORANGE, NAVY, "#6366F1", "#10B981", "#F59E0B"][i], color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i+1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY }}>{p.product?.name}</span>
              <span style={{ fontSize: 13, color: GRAY }}>{p.count} ออเดอร์</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>฿{Number(p.revenue).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daily export */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>ออเดอร์รายวัน</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }} />
          <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 8, background: "#10B981", color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>
            📥 Export CSV
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                {["เลขออเดอร์", "ลูกค้า", "สินค้า", "จำนวน", "ยอดรวม", "สถานะ"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: GRAY, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayOrders.map(o => (
                <tr key={o.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: ORANGE }}>{o.orderNumber}</td>
                  <td style={{ padding: "9px 12px" }}>{o.customerName}</td>
                  <td style={{ padding: "9px 12px", color: GRAY }}>{o.product?.name}</td>
                  <td style={{ padding: "9px 12px" }}>{o.qty}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 700 }}>฿{Number(o.total).toLocaleString()}</td>
                  <td style={{ padding: "9px 12px" }}>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!dayOrders.length && <p style={{ textAlign: "center", color: GRAY, padding: 20 }}>ไม่มีออเดอร์วันนี้</p>}
        </div>
      </div>
    </div>
  );
}
