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
  const [walkinStats, setWalkinStats] = useState(null);
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
  const [showUnpaid, setShowUnpaid]     = useState(false);
  const [showOverdue, setShowOverdue]   = useState(false);
  const [payFilterMethod, setPayFilterMethod] = useState(null); // "cash"|"qr"|"cod"|null
  const ALL_COLS = ["เลขออเดอร์", "ลูกค้า", "ที่อยู่", "สินค้า", "จำนวน (ถัง)", "ยอดรวม", "สถานะ"];
  const [visibleCols, setVisibleCols] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("reportVisibleCols") || "null") || ALL_COLS); } catch { return new Set(ALL_COLS); }
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const [showDailyOrders, setShowDailyOrders] = useState(false);
  function toggleCol(col) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      try { localStorage.setItem("reportVisibleCols", JSON.stringify([...next])); } catch {}
      return next;
    });
  }
  const [topCustYear, setTopCustYear]   = useState(now.getFullYear());
  const [topCustMonth, setTopCustMonth] = useState(0); // 0 = ทั้งปี
  const [topCustomers, setTopCustomers] = useState([]);
  const [topCustSort, setTopCustSort]   = useState("revenue"); // "revenue" | "orders"

  useEffect(() => {
    api.get(`/api/v1/reports/monthly?year=${year}&month=${month}`).then(r => {
      setDaily(r.data.daily || []);
      setTopProducts(r.data.topProducts || []);
      setWalkinStats(r.data.walkinStats || null);
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

  useEffect(() => {
    const params = new URLSearchParams({ year: topCustYear });
    if (topCustMonth) params.set("month", topCustMonth);
    api.get(`/api/v1/reports/top-customers?${params}`).then(r => setTopCustomers(r.data || [])).catch(() => {});
  }, [topCustYear, topCustMonth]);

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
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY }}>{p.name || p.product?.name}</span>
              <span style={{ fontSize: 13, color: GRAY }}>{p.qty ?? p.count} ถัง</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: 0 }}>ออเดอร์รายวัน</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }} />
          <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 8, background: "#10B981", color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>
            📥 Export CSV
          </button>
        </div>

        {/* Day summary — always visible */}
        {daySummary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
            {(() => {
              const cashRevenue = dayPayBreakdown.find(p => p.method === "cash")?.revenue || 0;
              const cashRemaining = Number(cashRevenue) - Number(dayTotalExpenses);
              return [
                { label: "ออเดอร์", value: parseInt(daySummary.count || 0) + " ออเดอร์", color: ORANGE },
                { label: "จำนวนถัง", value: parseInt(daySummary.gasTanks ?? daySummary.units ?? 0) + " ถัง", color: "#0EA5E9" },
                { label: "ยอดขายรวม", value: "฿" + Number(daySummary.revenue || 0).toLocaleString(), color: "#10B981" },
                { label: "ค่าใช้จ่าย", value: "฿" + dayTotalExpenses.toLocaleString(), color: "#EF4444" },
                { label: "เงินสุทธิ", value: "฿" + dayNetRevenue.toLocaleString(), color: dayNetRevenue >= 0 ? "#059669" : "#EF4444" },
                { label: "เงินสดคงเหลือ", value: "฿" + cashRemaining.toLocaleString(), color: cashRemaining >= 0 ? "#0369A1" : "#EF4444" },
              ];
            })().map(({ label, value, color }) => (
              <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", borderLeft: `4px solid ${color}` }}>
                <div style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Expenses breakdown — always visible */}
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

        {/* Payment method breakdown — always visible */}
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
                    <div key={i} onClick={() => setPayFilterMethod(p.method)} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 8px", marginBottom: 4, borderRadius: 8, cursor: "pointer", background: "#F0F9FF", border: "1.5px solid #E0F2FE" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                        {label} ({p.count} ออเดอร์)
                      </span>
                      <span style={{ fontWeight: 700, color }}>฿{Number(p.revenue).toLocaleString()} ▶</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Toggle for orders table */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, marginTop: 4 }}>
          <button onClick={() => setShowDailyOrders(v => !v)} style={{ padding: "5px 14px", borderRadius: 8, background: "none", border: "2px solid #E5E7EB", fontSize: 13, fontWeight: 700, cursor: "pointer", color: NAVY }}>
            {showDailyOrders ? "▲ ซ่อนรายการ" : "▼ ดูรายการออเดอร์"}
          </button>
        </div>

        {/* Unpaid orders (today) */}
        {showDailyOrders && dayUnpaid.length > 0 && (
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

        {showDailyOrders && dayOverdue.length > 0 && (
          <div style={{ background: "#FFF1F2", borderRadius: 10, marginBottom: 14, border: "1.5px solid #FECDD3", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowOverdue(v => !v)}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#9F1239" }}>🔴 ค้างจากวันก่อน {dayOverdue.length} รายการ — ไม่รวมในยอดวันนี้</span>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#BE123C" }}>{showOverdue ? "▲ ซ่อน" : "▼ ดูรายการ"}</span>
                <span onClick={e => { e.stopPropagation(); navigate("/orders?unpaid=1"); }} style={{ fontSize: 12, fontWeight: 700, color: "#BE123C", cursor: "pointer", textDecoration: "underline" }}>💸 ไปหน้าออเดอร์</span>
              </div>
            </div>
            {showOverdue && (
              <div style={{ borderTop: "1px solid #FECDD3", padding: "8px 14px 12px" }}>
                {dayOverdue.map((o, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#9F1239", padding: "6px 0", borderBottom: i < dayOverdue.length - 1 ? "1px solid #FFE4E6" : "none", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700 }}>{o.orderNumber}</span>
                    <span>{o.customerName}</span>
                    <span style={{ color: GRAY, fontSize: 11 }}>{new Date(o.createdAt).toLocaleDateString("th-TH")}</span>
                    <span style={{ fontWeight: 700 }}>฿{Number(o.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Column picker + table */}
        {showDailyOrders && (<><div style={{ position: "relative", marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setShowColPicker(v => !v)}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, fontSize: 12, fontWeight: 700, color: NAVY, cursor: "pointer" }}>
            ⚙️ คอลัมน์
          </button>
          {showColPicker && (
            <div style={{ position: "absolute", top: 32, right: 0, background: WHITE, border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,.12)", minWidth: 180 }}>
              {ALL_COLS.map(col => (
                <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} />
                  {col}
                </label>
              ))}
            </div>
          )}
        </div>
        <div style={{ overflowX: "auto" }} onClick={() => setShowColPicker(false)}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                {ALL_COLS.filter(h => visibleCols.has(h)).map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: GRAY, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayOrders.map(o => (
                <tr key={o.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {visibleCols.has("เลขออเดอร์") && <td style={{ padding: "9px 12px", fontWeight: 700, color: ORANGE }}>{o.orderNumber}</td>}
                  {visibleCols.has("ลูกค้า") && <td style={{ padding: "9px 12px" }}>{o.customerName}</td>}
                  {visibleCols.has("ที่อยู่") && <td style={{ padding: "9px 12px", color: GRAY, maxWidth: 200 }}>{o.deliveryAddress || "-"}</td>}
                  {visibleCols.has("สินค้า") && <td style={{ padding: "9px 12px", color: GRAY }}>{o.product?.name}</td>}
                  {visibleCols.has("จำนวน (ถัง)") && <td style={{ padding: "9px 12px" }}>{o.qty} ถัง</td>}
                  {visibleCols.has("ยอดรวม") && <td style={{ padding: "9px 12px", fontWeight: 700 }}>฿{Number(o.total).toLocaleString()}</td>}
                  {visibleCols.has("สถานะ") && <td style={{ padding: "9px 12px" }}>{o.status}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!dayOrders.length && <p style={{ textAlign: "center", color: GRAY, padding: 20 }}>ไม่มีออเดอร์วันนี้</p>}
        </div></>)}
      </div>

      {/* Payment method order list modal */}
      {/* Top Customers */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: NAVY, margin: 0 }}>🏆 ลูกค้าสั่งมากสุด</h2>
          <select value={topCustYear} onChange={e => setTopCustYear(Number(e.target.value))}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13 }}>
            {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <select value={topCustMonth} onChange={e => setTopCustMonth(Number(e.target.value))}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13 }}>
            <option value={0}>ทั้งปี</option>
            {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."].map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {[["revenue", "เรียงยอดเงิน"], ["orders", "เรียงจำนวนครั้ง"]].map(([val, label]) => (
              <button key={val} onClick={() => setTopCustSort(val)}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: topCustSort === val ? NAVY : "#F3F4F6", color: topCustSort === val ? WHITE : GRAY }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: NAVY, fontWeight: 700 }}>อันดับ</th>
                <th style={{ padding: "8px 12px", textAlign: "left", color: NAVY, fontWeight: 700 }}>ลูกค้า</th>
                <th style={{ padding: "8px 12px", textAlign: "left", color: NAVY, fontWeight: 700 }}>เบอร์</th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: NAVY, fontWeight: 700, cursor: "pointer" }} onClick={() => setTopCustSort("orders")}>
                  จำนวนครั้ง {topCustSort === "orders" ? "▼" : ""}
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", color: NAVY, fontWeight: 700, cursor: "pointer" }} onClick={() => setTopCustSort("revenue")}>
                  ยอดรวม {topCustSort === "revenue" ? "▼" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...topCustomers].sort((a, b) => b[topCustSort] - a[topCustSort]).map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? WHITE : "#FAFAFA" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 800, color: i < 3 ? ORANGE : GRAY }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ fontWeight: 700, color: NAVY }}>{c.name}</div>
                    {c.address && <div style={{ fontSize: 11, color: GRAY }}>📍 {c.address}</div>}
                  </td>
                  <td style={{ padding: "9px 12px", color: GRAY }}>{c.phone || "-"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>{c.orders} ครั้ง</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: ORANGE }}>฿{c.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!topCustomers.length && <p style={{ textAlign: "center", color: GRAY, padding: 20 }}>ยังไม่มีข้อมูล</p>}
        </div>
      </div>

      {payFilterMethod && (() => {
        const label = payFilterMethod === "cash" ? "เงินสด" : payFilterMethod === "qr" ? "QR โอน" : "เก็บปลายทาง";
        const color = payFilterMethod === "cash" ? "#10B981" : payFilterMethod === "qr" ? "#3B82F6" : "#F59E0B";
        const filtered = dayOrders.filter(o => o.paymentMethod === payFilterMethod && o.status !== "cancelled");
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setPayFilterMethod(null)}>
            <div style={{ background: WHITE, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "75vh", display: "flex", flexDirection: "column" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: "16px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>💳 {label} — {filtered.length} ออเดอร์</span>
                <button onClick={() => setPayFilterMethod(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", padding: "10px 18px 24px" }}>
                {filtered.length === 0 && <p style={{ textAlign: "center", color: GRAY, padding: 20 }}>ไม่มีออเดอร์</p>}
                {filtered.map((o, i) => (
                  <div key={o.id} style={{ padding: "10px 0", borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{o.orderNumber}</div>
                      {o.deliveryAddress && <div style={{ fontSize: 12, color: NAVY, fontWeight: 600, marginTop: 1 }}>📍 {o.deliveryAddress}</div>}
                      {o.customerName && o.customerName !== "ลูกค้าหน้าร้าน" && <div style={{ fontSize: 11, color: GRAY }}>👤 {o.customerName}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color }}> ฿{Number(o.total).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: o.isPaid ? "#10B981" : "#EF4444" }}>{o.isPaid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
