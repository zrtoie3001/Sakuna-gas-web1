import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const NAVY2 = "#0F1D52"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

const STATUS_NEXT = {
  pending:          { next: "preparing",       label: "รับงาน",      color: "#1E40AF", bg: "#DBEAFE" },
  preparing:        { next: "out_for_delivery", label: "ออกส่งแล้ว", color: "#075985", bg: "#E0F2FE" },
  out_for_delivery: { next: "delivered",        label: "ส่งสำเร็จ ✅", color: "#065F46", bg: "#D1FAE5" },
};

const STATUS_LABEL = {
  pending:           "⏳ รอรับงาน",
  preparing:         "📦 เตรียมสินค้า",
  out_for_delivery:  "🛵 กำลังส่ง",
  near_destination:  "🛵 กำลังส่ง",
  delivered:         "✅ ส่งสำเร็จ",
};

export default function Dashboard() {
  const [tab, setTab]           = useState("pending");
  const [pendingOrders, setPending] = useState([]);
  const [myOrders, setMyOrders]     = useState([]);
  const [doneOrders, setDone]       = useState([]);
  const [updating, setUpdating]     = useState(null);
  const [location, setLocation]     = useState(null);
  const [route, setRoute]           = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("driver_user") || "{}");

  const loadOrders = useCallback(async () => {
    const [pend, mine] = await Promise.all([
      api.get("/api/v1/drivers/pending").then(r => r.data).catch(() => []),
      api.get("/api/v1/drivers/my-orders").then(r => r.data).catch(() => []),
    ]);
    setPending(pend);
    setMyOrders(mine.filter(o => o.status !== "delivered"));
    setDone(mine.filter(o => o.status === "delivered"));
  }, []);

  useEffect(() => {
    loadOrders();
    const iv = setInterval(loadOrders, 20000);
    return () => clearInterval(iv);
  }, [loadOrders]);

  // GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setLocation({ lat, lng });
      api.put("/api/v1/drivers/location", { lat, lng }).catch(() => {});
    }, null, { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // Optimized route
  useEffect(() => {
    if (!location || !myOrders.length) return;
    api.get(`/api/v1/drivers/route?lat=${location.lat}&lng=${location.lng}`)
      .then(r => setRoute(r.data))
      .catch(() => {});
  }, [location, myOrders.length]);

  async function acceptOrder(orderId) {
    setUpdating(orderId);
    await api.post(`/api/v1/orders/${orderId}/accept`).catch(() => {});
    setUpdating(null); loadOrders();
  }

  async function updateStatus(orderId, status) {
    setUpdating(orderId);
    const eta = status === "out_for_delivery" && location
      ? Math.ceil(Math.random() * 20 + 10) // ในการใช้งานจริง คำนวณจาก Maps API
      : undefined;
    await api.put(`/api/v1/orders/${orderId}/status`, { status, estimatedMinutes: eta }).catch(() => {});
    setUpdating(null); loadOrders();
  }

  function openNavigation(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, "_blank");
  }

  function logout() {
    localStorage.removeItem("driver_token"); localStorage.removeItem("driver_user");
    navigate("/login");
  }

  const tabs = [
    { key: "pending", label: "รอรับงาน", count: pendingOrders.length },
    { key: "active",  label: "กำลังส่ง", count: myOrders.length },
    { key: "route",   label: "เส้นทาง",  count: route.length },
    { key: "done",    label: "เสร็จแล้ว", count: doneOrders.length },
  ];

  const OrderCard = ({ order, showAccept, showStatus }) => {
    const nextAction = STATUS_NEXT[order.status];
    return (
      <div style={{
        background: WHITE, borderRadius: 14, padding: 14, marginBottom: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,.07)", border: "1px solid #E5E7EB",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 900, color: ORANGE }}>{order.orderNumber}</span>
            <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 6, fontWeight: 700,
              background: nextAction?.bg || "#F3F4F6", color: nextAction?.color || GRAY }}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>฿{Number(order.total).toLocaleString()}</span>
        </div>

        {/* Info */}
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          <p><span style={{ color: GRAY }}>👤</span> <strong>{order.customerName}</strong> · {order.customerPhone}</p>
          <p><span style={{ color: GRAY }}>🛢</span> {order.product?.name} ({order.brand?.name}) × {order.qty}</p>
          <p style={{ color: GRAY, lineHeight: 1.4 }}>📍 {order.deliveryAddress}</p>
          {order.note && <p style={{ color: "#92400E", background: "#FFF7ED", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>💬 {order.note}</p>}
          {order.estimatedMinutes && (
            <p style={{ color: "#059669", fontSize: 12 }}>⏱ ETA: ~{order.estimatedMinutes} นาที</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          {order.deliveryLat && (
            <button onClick={() => openNavigation(order.deliveryLat, order.deliveryLng)} style={{
              flex: 1, padding: "10px 6px", borderRadius: 10, border: "none",
              background: "#1D4ED8", color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              🗺 นำทาง
            </button>
          )}
          {showAccept && (
            <button onClick={() => acceptOrder(order.id)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: ORANGE, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>
              {updating === order.id ? "..." : "✋ รับงาน"}
            </button>
          )}
          {showStatus && nextAction && (
            <button onClick={() => updateStatus(order.id, nextAction.next)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: nextAction.next === "delivered" ? "#059669" : NAVY,
              color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>
              {updating === order.id ? "..." : nextAction.label}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FB", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY2}, ${NAVY})`,
        padding: "14px 16px", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(10,18,50,.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: WHITE, fontWeight: 900, fontSize: 18 }}>
              🛵 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
            </div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>พนักงาน: {user.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {location && (
              <span style={{ fontSize: 11, color: "#34D399", background: "rgba(52,211,153,.15)", padding: "3px 8px", borderRadius: 6 }}>
                📡 GPS ON
              </span>
            )}
            <button onClick={logout} style={{ background: "rgba(255,255,255,.15)", border: "none", color: WHITE, padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>ออก</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.key ? WHITE : "rgba(255,255,255,.12)",
              color: tab === t.key ? NAVY : "rgba(255,255,255,.7)",
              fontSize: 11, fontWeight: tab === t.key ? 800 : 400,
              transition: "all .15s",
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ marginLeft: 4, background: tab === t.key ? ORANGE : "rgba(255,255,255,.3)", color: WHITE, borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 14px 80px" }}>

        {/* Pending orders */}
        {tab === "pending" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>ออเดอร์รอรับงาน · {pendingOrders.length} รายการ</p>
            {pendingOrders.map(o => <OrderCard key={o.id} order={o} showAccept />)}
            {!pendingOrders.length && <EmptyState icon="📭" text="ไม่มีออเดอร์รอรับงาน" />}
          </>
        )}

        {/* Active orders */}
        {tab === "active" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>ออเดอร์ที่รับแล้ว · {myOrders.length} รายการ</p>
            {myOrders.map(o => <OrderCard key={o.id} order={o} showStatus />)}
            {!myOrders.length && <EmptyState icon="✅" text="ไม่มีออเดอร์ที่กำลังส่ง" />}
          </>
        )}

        {/* Route optimization */}
        {tab === "route" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>เส้นทางแนะนำ (เรียงลำดับที่ควรส่ง)</p>
            {route.map((stop, i) => (
              <div key={stop.orderId} style={{ background: WHITE, borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: i === 0 ? ORANGE : NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{stop.customerName}</p>
                  <p style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{stop.address}</p>
                  <p style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 2 }}>{stop.orderNumber}</p>
                </div>
                <button onClick={() => openNavigation(stop.lat, stop.lng)} style={{
                  padding: "8px 10px", borderRadius: 8, border: "none", background: "#1D4ED8", color: WHITE, fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>🗺</button>
              </div>
            ))}
            {!route.length && <EmptyState icon="🗺" text="ไม่มีเส้นทางที่ต้องนำทาง" />}
          </>
        )}

        {/* Done */}
        {tab === "done" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>ส่งสำเร็จวันนี้ · {doneOrders.length} รายการ</p>
            {doneOrders.map(o => (
              <div key={o.id} style={{ background: WHITE, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", gap: 10, alignItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,.05)", opacity: 0.75 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{o.orderNumber}</p>
                  <p style={{ fontSize: 12, color: GRAY }}>{o.customerName} · {o.product?.name} ×{o.qty}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>฿{Number(o.total).toLocaleString()}</span>
              </div>
            ))}
            {!doneOrders.length && <EmptyState icon="📋" text="ยังไม่มีออเดอร์ที่ส่งสำเร็จ" />}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{text}</p>
    </div>
  );
}
