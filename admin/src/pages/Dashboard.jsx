import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const STATUS_LABEL = {
  pending:            { label: "รอรับงาน",       bg: "#FEF3C7", color: "#92400E" },
  preparing:          { label: "เตรียมสินค้า",    bg: "#DBEAFE", color: "#1E40AF" },
  out_for_delivery:   { label: "กำลังส่ง",        bg: "#E0F2FE", color: "#075985" },
  near_destination:   { label: "ใกล้ถึง",         bg: "#D1FAE5", color: "#065F46" },
  delivered:          { label: "ส่งสำเร็จ",       bg: "#D1FAE5", color: "#065F46" },
  cancelled:          { label: "ยกเลิก",          bg: "#FEE2E2", color: "#991B1B" },
};

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: WHITE, borderRadius: 14, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 13, color: GRAY }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get("/api/v1/reports/dashboard").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/v1/orders?limit=10").then(r => setOrders(r.data.orders || [])).catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 20 }}>📊 Dashboard</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon="📦" label="ออเดอร์วันนี้" value={stats?.today?.orders ?? "—"} color={ORANGE} />
        <StatCard icon="💰" label="ยอดขายวันนี้" value={stats ? `฿${stats.today.revenue.toLocaleString()}` : "—"} color="#10B981" />
        <StatCard icon="📅" label="ยอดขายเดือนนี้" value={stats ? `฿${stats.month.revenue.toLocaleString()}` : "—"} color="#6366F1" />
        <StatCard icon="👥" label="ลูกค้าทั้งหมด" value={stats?.totalCustomers ?? "—"} color="#F59E0B" />
        <StatCard icon="⏳" label="รอดำเนินการ" value={stats?.pendingOrders ?? "—"} color="#EF4444"
          sub={stats?.pendingOrders > 0 ? "⚠️ มีออเดอร์รอดำเนินการ" : undefined} />
      </div>

      {/* Recent Orders */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 16 }}>ออเดอร์ล่าสุด</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F3F4F6" }}>
                {["เลขออเดอร์", "ลูกค้า", "สินค้า", "ยอด", "สถานะ", "เวลา"].map(h => (
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
                      <span style={{ background: st.bg, color: st.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {st.label}
                      </span>
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
      </div>
    </div>
  );
}
