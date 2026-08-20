import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

export default function Reports() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [daily, setDaily] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [date, setDate]   = useState(now.toISOString().split("T")[0]);
  const [dayOrders, setDayOrders] = useState([]);
  const [dayExpenses, setDayExpenses] = useState([]);
  const [dayTotalExpenses, setDayTotalExpenses] = useState(0);
  const [dayNetRevenue, setDayNetRevenue] = useState(0);
  const [daySummary, setDaySummary] = useState(null);
  const [dayUnpaid, setDayUnpaid] = useState([]);
  const [dayOverdue, setDayOverdue] = useState([]);
  const [dayPayBreakdown, setDayPayBreakdown] = useState([]);
  const [driverStats, setDriverStats] = useState([]);
  const [driverDate, setDriverDate]   = useState(now.toISOString().split("T")[0]);
  const [showUnpaid, setShowUnpaid]   = useState(false);

  useEffect(() => {
    api.get(`/api/v1/reports/monthly?year=${year}&month=${month}`).then(r => {
      setDaily(r.data.daily || []);
      setTopProducts(r.data.topProducts || []);
    }).catch(() => {});
  }, [year, month]);

  useEffect(() => {
    api.get(`/api/v1/reports/daily?date=${date}`).then(r => {
      setDayOrders(r.data.orders || []);
      setDayExpenses(r.data.expenses || []);
      setDayTotalExpenses(r.data.totalExpenses || 0);
      setDayNetRevenue(r.data.netRevenue || 0);
      setDaySummary(r.data.summary || null);
      setDayUnpaid(r.data.unpaidOrders || []);
      setDayOverdue(r.data.overdueOrders || []);
      setDayPayBreakdown(r.data.payBreakdown || []);
    }).catch(() => {});
  }, [date]);

  useEffect(() => {
    api.get(`/api/v1/reports/driver-stats?date=${driverDate}`).then(r => setDriverStats(r.data.drivers || [])).catch(() => {});
  }, [driverDate]);

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

      {/* Driver Stats */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>🛵 สรุปยอดส่งแต่ละ Rider</h2>
          <input type="date" value={driverDate} onChange={e => setDriverDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }} />
        </div>
        {driverStats.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {driverStats.map((d, i) => (
              <div key={i} style={{ background: "#F8FAFC", borderRadius: 12, padding: 16, border: "2px solid #E5E7EB" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🛵 {d.name}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: GRAY }}>ออเดอร์</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{d.orders} รายการ</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: GRAY }}>ถังที่ส่ง</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#F47B20" }}>{d.tanks} ถัง</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: GRAY, textAlign: "center", padding: 16 }}>ยังไม่มีข้อมูลการส่งวันนี้</p>
        )}
      </div>

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

        {/* Day summary: orders, tanks, revenue, expenses, net */}
        {daySummary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "ออเดอร์", value: parseInt(daySummary.count || 0) + " ออเดอร์", color: ORANGE },
              { label: "จำนวนถัง", value: parseInt(daySummary.units || 0) + " ถัง", color: "#0EA5E9" },
              { label: "ยอดขายรวม", value: "฿" + Number(daySummary.revenue || 0).toLocaleString(), color: "#10B981" },
              { label: "ค่าใช้จ่าย", value: "฿" + dayTotalExpenses.toLocaleString(), color: "#EF4444" },
              { label: "เงินสุทธิ", value: "฿" + dayNetRevenue.toLocaleString(), color: dayNetRevenue >= 0 ? "#059669" : "#EF4444" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", borderLeft: `4px solid ${color}` }}>
                <div style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Expenses breakdown */}
        {dayExpenses.length > 0 && (
          <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1.5px solid #FECACA" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", marginBottom: 8 }}>🧾 ค่าใช้จ่ายวันนี้ — รวม ฿{dayTotalExpenses.toLocaleString()}</div>
            {dayExpenses.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: "#7F1D1D", padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                <span>{e.description || e.type}{e.createdByName ? ` (${e.createdByName})` : ""}</span>
                <span style={{ fontWeight: 700 }}>฿{Number(e.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Payment method breakdown */}
        {dayPayBreakdown.length > 0 && (
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 14, border: "1.5px solid #E5E7EB" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10 }}>💳 ช่องทางชำระเงิน</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <PieChart width={120} height={120}>
                <Pie data={dayPayBreakdown.map(p => ({ name: p.method === "cash" ? "เงินสด" : p.method === "qr" ? "QR โอน" : "เก็บปลายทาง", value: p.revenue }))} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                  {dayPayBreakdown.map((p, i) => (
                    <Cell key={i} fill={p.method === "cash" ? "#10B981" : p.method === "qr" ? "#3B82F6" : "#F59E0B"} />
                  ))}
                </Pie>
                <Tooltip formatter={v => `฿${Number(v).toLocaleString()}`} />
              </PieChart>
              <div style={{ flex: 1 }}>
                {dayPayBreakdown.map((p, i) => {
                  const label = p.method === "cash" ? "เงินสด" : p.method === "qr" ? "QR โอน" : "เก็บปลายทาง";
                  const color = p.method === "cash" ? "#10B981" : p.method === "qr" ? "#3B82F6" : "#F59E0B";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #F3F4F6" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                        {label} ({p.count} ออเดอร์)
                      </span>
                      <span style={{ fontWeight: 700, color }}> ฿{Number(p.revenue).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Unpaid orders (today) */}
        {dayUnpaid.length > 0 && (
          <div style={{ background: "#FEF3C7", borderRadius: 10, marginBottom: 14, border: "1.5px solid #FCD34D", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span onClick={() => setShowUnpaid(v => !v)} style={{ fontSize: 13, fontWeight: 800, color: "#92400E", cursor: "pointer" }}>⚠️ ค้างเงินวันนี้ ({dayUnpaid.length} รายการ)</span>
              <div style={{ display: "flex", gap: 10 }}>
                <span onClick={() => setShowUnpaid(v => !v)} style={{ fontSize: 12, color: "#92400E", cursor: "pointer" }}>{showUnpaid ? "▲ ซ่อน" : "▼ ดูรายการ"}</span>
                <span onClick={() => navigate("/debts")} style={{ fontSize: 12, fontWeight: 700, color: "#B45309", cursor: "pointer", textDecoration: "underline" }}>💸 ไปหน้าค้างเงิน</span>
              </div>
            </div>
            {showUnpaid && (
              <div style={{ borderTop: "1px solid #FCD34D", padding: "8px 14px 12px" }}>
                {dayUnpaid.map((o, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#78350F", padding: "6px 0", borderBottom: i < dayUnpaid.length - 1 ? "1px solid #FDE68A" : "none", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700 }}>{o.orderNumber}</span>
                    <span>{o.customerName}</span>
                    <span style={{ fontWeight: 700 }}>฿{Number(o.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dayOverdue.length > 0 && (
          <div style={{ background: "#FFF1F2", borderRadius: 10, marginBottom: 14, border: "1.5px solid #FECDD3", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#9F1239" }}>🔴 ค้างจากวันก่อน {dayOverdue.length} รายการ — ไม่รวมในยอดวันนี้</span>
            <span onClick={() => navigate("/debts")} style={{ fontSize: 12, fontWeight: 700, color: "#BE123C", cursor: "pointer", textDecoration: "underline" }}>💸 ดูรายการ</span>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                {["เลขออเดอร์", "ลูกค้า", "สินค้า", "จำนวน (ถัง)", "ยอดรวม", "สถานะ"].map(h => (
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
                  <td style={{ padding: "9px 12px" }}>{o.qty} ถัง</td>
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
