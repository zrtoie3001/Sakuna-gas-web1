import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "../utils/api.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";
const COLORS = ["#6366F1", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"];

const STATUS_LABEL = {
  pending:            { label: "รอรับงาน",    bg: "#FEF3C7", color: "#92400E" },
  preparing:          { label: "เตรียมสินค้า", bg: "#DBEAFE", color: "#1E40AF" },
  out_for_delivery:   { label: "กำลังส่ง",     bg: "#E0F2FE", color: "#075985" },
  near_destination:   { label: "ใกล้ถึง",      bg: "#D1FAE5", color: "#065F46" },
  delivered:          { label: "ส่งสำเร็จ",    bg: "#D1FAE5", color: "#065F46" },
  cancelled:          { label: "ยกเลิก",       bg: "#FEE2E2", color: "#991B1B" },
};

const PAYMENT_LABEL = { cash: "เงินสด", qr: "QR โอน", cod: "เก็บปลายทาง" };

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 13, color: GRAY }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [orders, setOrders] = useState([]);
  const [showWalkin, setShowWalkin] = useState(false);
  const [collapsed, setCollapsed] = useState({ gas: false, newTanks: false, equipment: false });
  const toggleSection = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  useEffect(() => {
    api.get("/api/v1/reports/dashboard").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/v1/orders?limit=10").then(r => setOrders(r.data.orders || [])).catch(() => {});
  }, []);

  const trend = stats?.trend7?.map(d => ({
    date: new Date(d.date).toLocaleDateString("th-TH", { weekday: "short", day: "numeric" }),
    ออเดอร์: d.count,
    ยอดขาย: d.revenue,
  })) || [];

  const payPie = (stats?.paymentBreakdown || []).map(p => ({
    name: PAYMENT_LABEL[p.method] || p.method,
    value: p.count,
  }));

  function payRevenue(breakdown, method) {
    const match = (breakdown || []).filter(p =>
      method === "cash" ? p.method === "cash" : ["qr", "transfer", "cod"].includes(p.method)
    );
    return match.reduce((s, p) => s + p.revenue, 0);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>📊 Dashboard</h1>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <StatCard icon="📦" label="ออเดอร์วันนี้"   value={stats?.today?.orders ?? "—"} color={ORANGE} />
        <StatCard icon="🛢" label="จำนวนถังวันนี้"  value={stats ? `${stats.today.tanks ?? 0} ถัง` : "—"} color="#0EA5E9" />
        <StatCard icon="💰" label="ยอดขายวันนี้"    value={stats ? `฿${stats.today.revenue.toLocaleString()}` : "—"} color="#10B981" />
        <StatCard icon="📅" label="ยอดขายเดือนนี้"  value={stats ? `฿${stats.month.revenue.toLocaleString()}` : "—"} color="#6366F1" />
        <StatCard icon="👥" label="ลูกค้าทั้งหมด"   value={stats?.totalCustomers ?? "—"} color="#F59E0B" />
        <StatCard icon="⏳" label="รอดำเนินการ"     value={stats?.pendingOrders ?? "—"} color="#EF4444"
          sub={stats?.pendingOrders > 0 ? "⚠️ มีออเดอร์รอ" : undefined} />
        <div
          onClick={() => stats?.monthWalkin && setShowWalkin(true)}
          style={{ background: WHITE, borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: "4px solid #8B5CF6", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>🏪</span>
            <span style={{ fontSize: 13, color: GRAY }}>ขายหน้าร้านเดือนนี้</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{stats?.monthWalkin?.tanks ?? 0} ถัง</div>
          <div style={{ fontSize: 11, color: "#8B5CF6", marginTop: 4 }}>กดเพื่อดูรายละเอียด</div>
        </div>
      </div>

      {/* Walk-in Detail Modal */}
      {showWalkin && stats?.monthWalkin && (
        <div onClick={() => setShowWalkin(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: WHITE, borderRadius: 16, padding: 28, width: 520, maxWidth: "92vw", maxHeight: "82vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: NAVY, margin: 0 }}>🏪 ยอดขายหน้าร้านเดือนนี้</h2>
              <button onClick={() => setShowWalkin(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: GRAY, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 18 }}>
              {stats.monthWalkin.count} รายการ · {stats.monthWalkin.tanks} ถัง · ฿{stats.monthWalkin.revenue?.toLocaleString()}
            </div>

            {/* Gas by brand */}
            {stats.monthWalkin.gasByBrand?.length > 0 && (
              <div style={{ marginBottom: 16, border: "1px solid #F3F4F6", borderRadius: 10, overflow: "hidden" }}>
                <button
                  onClick={() => toggleSection("gas")}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8FAFC", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: NAVY }}
                >
                  <span>🛢 แก๊สแยกยี่ห้อ</span>
                  <span style={{ color: GRAY, fontSize: 12 }}>{collapsed.gas ? "▼ ดูรายการ" : "▲ ซ่อน"}</span>
                </button>
                {!collapsed.gas && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                        <th style={{ textAlign: "left", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>สินค้า</th>
                        <th style={{ textAlign: "right", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>จำนวน (ถัง)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.monthWalkin.gasByBrand.map((b, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}>
                          <td style={{ padding: "9px 14px", color: NAVY, fontWeight: 600 }}>{b.name}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: ORANGE }}>{b.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* New tanks */}
            {stats.monthWalkin.newTanks?.length > 0 && (
              <div style={{ marginBottom: 16, border: "1px solid #F3F4F6", borderRadius: 10, overflow: "hidden" }}>
                <button
                  onClick={() => toggleSection("newTanks")}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8FAFC", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: NAVY }}
                >
                  <span>🆕 ถังใหม่</span>
                  <span style={{ color: GRAY, fontSize: 12 }}>{collapsed.newTanks ? "▼ ดูรายการ" : "▲ ซ่อน"}</span>
                </button>
                {!collapsed.newTanks && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                        <th style={{ textAlign: "left", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>รายการ</th>
                        <th style={{ textAlign: "right", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>จำนวน (ถัง)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.monthWalkin.newTanks.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}>
                          <td style={{ padding: "9px 14px", color: NAVY }}>{t.name}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: "#10B981" }}>{t.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Equipment */}
            {stats.monthWalkin.equipment?.length > 0 && (
              <div style={{ marginBottom: 8, border: "1px solid #F3F4F6", borderRadius: 10, overflow: "hidden" }}>
                <button
                  onClick={() => toggleSection("equipment")}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8FAFC", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: NAVY }}
                >
                  <span>🔧 อะไหล่ / อุปกรณ์</span>
                  <span style={{ color: GRAY, fontSize: 12 }}>{collapsed.equipment ? "▼ ดูรายการ" : "▲ ซ่อน"}</span>
                </button>
                {!collapsed.equipment && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                        <th style={{ textAlign: "left", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>รายการ</th>
                        <th style={{ textAlign: "right", padding: "6px 14px", color: GRAY, fontWeight: 600 }}>จำนวน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.monthWalkin.equipment.map((e, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}>
                          <td style={{ padding: "9px 14px", color: NAVY }}>{e.name}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: GRAY }}>{e.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {stats.monthWalkin.tanks === 0 && (
              <p style={{ textAlign: "center", color: GRAY, padding: 20 }}>ยังไม่มีการขายหน้าร้านเดือนนี้</p>
            )}
          </div>
        </div>
      )}

      {/* Cash vs Transfer today */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div style={{ background: WHITE, borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: "4px solid #10B981" }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 4, fontWeight: 700 }}>💵 เงินสด — วันนี้</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#065F46" }}>฿{payRevenue(stats?.todayPayBreakdown, "cash").toLocaleString()}</div>
          <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>เดือนนี้ ฿{payRevenue(stats?.monthPayBreakdown, "cash").toLocaleString()}</div>
        </div>
        <div style={{ background: WHITE, borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: "4px solid #6366F1" }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 4, fontWeight: 700 }}>📲 เงินโอน — วันนี้</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#3730A3" }}>฿{payRevenue(stats?.todayPayBreakdown, "transfer").toLocaleString()}</div>
          <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>เดือนนี้ ฿{payRevenue(stats?.monthPayBreakdown, "transfer").toLocaleString()}</div>
        </div>
        <div style={{ background: WHITE, borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: "4px solid #F59E0B" }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 4, fontWeight: 700 }}>💰 รวมทั้งหมด — วันนี้</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>฿{(stats?.today?.revenue ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>เดือนนี้ ฿{(stats?.month?.revenue ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <Card title="📈 ยอดขาย 7 วันล่าสุด">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
              <YAxis tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => name === "ยอดขาย" ? [`฿${v.toLocaleString()}`, name] : [v, name]} />
              <Bar dataKey="ยอดขาย" fill={NAVY} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="💳 วิธีชำระเงิน (เดือนนี้)">
          {payPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={payPie} dataKey="value" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {payPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: GRAY, textAlign: "center", paddingTop: 60 }}>ยังไม่มีข้อมูล</p>}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card title="🏆 สินค้าขายดี (เดือนนี้)">
          {(stats?.topProducts || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: GRAY }} width={70} />
                <Tooltip formatter={v => [`${v} ถัง`, "จำนวน"]} />
                <Bar dataKey="qty" fill={ORANGE} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: GRAY, textAlign: "center", paddingTop: 60 }}>ยังไม่มีข้อมูล</p>}
        </Card>

        <Card title="🛢 ยอดขายแยกยี่ห้อ (เดือนนี้)">
          {(stats?.brandBreakdown || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.brandBreakdown} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} tickFormatter={v => `฿${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: GRAY }} width={50} />
                <Tooltip formatter={v => [`฿${Number(v).toLocaleString()}`, "ยอดขาย"]} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: GRAY, textAlign: "center", paddingTop: 60 }}>ยังไม่มีข้อมูล</p>}
        </Card>
      </div>

      {/* Recent Orders */}
      <Card title="📋 ออเดอร์ล่าสุด">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F3F4F6" }}>
                {["เลขออเดอร์","ลูกค้า","สินค้า","ยอด","สถานะ","เวลา"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: GRAY, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const st = STATUS_LABEL[o.status] || { label: o.status, bg: "#F3F4F6", color: GRAY };
                return (
                  <tr key={o.id} style={{ borderBottom: "1px solid #F9FAFB" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: ORANGE }}>{o.orderNumber}</td>
                    <td style={{ padding: "10px", color: NAVY }}>{o.customerName}</td>
                    <td style={{ padding: "10px", color: GRAY }}>{o.product?.name} ×{o.qty}</td>
                    <td style={{ padding: "10px", fontWeight: 700, color: NAVY }}>฿{Number(o.total).toLocaleString()}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "10px", color: GRAY, whiteSpace: "nowrap" }}>
                      {new Date(o.createdAt).toLocaleString("th-TH", { timeStyle: "short", dateStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!orders.length && <p style={{ color: GRAY, textAlign: "center", padding: 20 }}>ยังไม่มีออเดอร์</p>}
        </div>
      </Card>
    </div>
  );
}
