import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const NAVY2 = "#0F1D52"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

const STATUS_NEXT = {
  pending:          { next: "preparing",       label: "รับงาน",       color: "#1E40AF", bg: "#DBEAFE" },
  preparing:        { next: "out_for_delivery", label: "ออกส่งแล้ว",  color: "#075985", bg: "#E0F2FE" },
  out_for_delivery: { next: "delivered",        label: "ส่งสำเร็จ ✅", color: "#065F46", bg: "#D1FAE5" },
};

const STATUS_LABEL = {
  pending:          "⏳ รอรับงาน",
  preparing:        "📦 เตรียมสินค้า",
  out_for_delivery: "🛵 กำลังส่ง",
  near_destination: "🛵 กำลังส่ง",
  delivered:        "✅ ส่งสำเร็จ",
};

export default function Dashboard() {
  const [tab, setTab]             = useState("pending");
  const [pendingOrders, setPending] = useState([]);
  const [myOrders, setMyOrders]   = useState([]);
  const [doneOrders, setDone]     = useState([]);
  const [updating, setUpdating]   = useState(null);
  const [location, setLocation]   = useState(null);
  // routeOrder: orderId[] in optimized sequence
  const [routeOrder, setRouteOrder] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
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

  // Fetch optimized route whenever active orders change or location changes
  useEffect(() => {
    const activeOrders = myOrders.filter(o => o.status === "out_for_delivery" || o.status === "preparing");
    if (activeOrders.length < 2) {
      setRouteOrder(activeOrders.map(o => o.id));
      return;
    }
    const lat = location?.lat || 13.8; // fallback to Bangkok area
    const lng = location?.lng || 100.5;
    setRouteLoading(true);
    api.get(`/api/v1/drivers/route?lat=${lat}&lng=${lng}`)
      .then(r => {
        const ordered = r.data;
        if (Array.isArray(ordered) && ordered.length) setRouteOrder(ordered.map(s => s.orderId));
        else setRouteOrder(activeOrders.map(o => o.id));
      })
      .catch(() => setRouteOrder(activeOrders.map(o => o.id)))
      .finally(() => setRouteLoading(false));
  }, [myOrders.length, location?.lat, location?.lng]);

  // Sort active orders by optimized route order
  const sortedActiveOrders = routeOrder.length
    ? [...myOrders].sort((a, b) => {
        const ia = routeOrder.indexOf(a.id);
        const ib = routeOrder.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
    : myOrders;

  async function acceptOrder(orderId) {
    setUpdating(orderId);
    await api.post(`/api/v1/orders/${orderId}/accept`).catch(() => {});
    setUpdating(null); loadOrders();
  }

  async function updateStatus(orderId, status) {
    setUpdating(orderId);
    await api.put(`/api/v1/orders/${orderId}/status`, { status }).catch(() => {});
    setUpdating(null); loadOrders();
  }

  function openNavigation(lat, lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, "_blank");
  }

  // Open Google Maps with all stops in optimized order
  function openFullRoute() {
    if (sortedActiveOrders.length === 0) return;
    const waypoints = sortedActiveOrders.slice(0, -1).map(o => `${o.deliveryLat},${o.deliveryLng}`).join("|");
    const last = sortedActiveOrders[sortedActiveOrders.length - 1];
    const origin = location ? `${location.lat},${location.lng}` : "";
    const base = "https://www.google.com/maps/dir/?api=1";
    const url = origin
      ? `${base}&origin=${origin}&destination=${last.deliveryLat},${last.deliveryLng}&waypoints=${waypoints}&travelmode=driving`
      : `${base}&destination=${last.deliveryLat},${last.deliveryLng}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, "_blank");
  }

  function logout() {
    localStorage.removeItem("driver_token"); localStorage.removeItem("driver_user");
    navigate("/login");
  }

  const tabs = [
    { key: "pending", label: "รอรับงาน",  count: pendingOrders.length },
    { key: "active",  label: "กำลังส่ง",  count: myOrders.length },
    { key: "done",    label: "เสร็จแล้ว", count: doneOrders.length },
  ];

  const OrderCard = ({ order, showAccept, showStatus, routeIndex }) => {
    const nextAction = STATUS_NEXT[order.status];
    const isFirst = routeIndex === 0 && sortedActiveOrders.length > 1;
    const [savedLoc, setSavedLoc] = useState(null);
    const [locSaving, setLocSaving] = useState(false);
    const [locStatus, setLocStatus] = useState(null);

    // Load saved location for this customer
    useEffect(() => {
      if (!order.customerPhone) return;
      api.get(`/api/v1/customers/location/by-contact?phone=${encodeURIComponent(order.customerPhone)}`)
        .then(r => setSavedLoc(r.data || null)).catch(() => {});
    }, [order.customerPhone]);

    // Parse note: strip __phone_walkin: JSON, show human-readable items
    const noteRaw = order.note || "";
    let walkinItems = null;
    let userNote = noteRaw;
    if (noteRaw.match(/^__(?:phone_)?walkin:/)) {
      try {
        const w = JSON.parse(noteRaw.replace(/^__(?:phone_)?walkin:/, "").split("\n")[0]);
        walkinItems = w.type === "mixed" ? (w.items || []) : [w];
        userNote = noteRaw.split("\n").slice(1).join("\n").trim();
      } catch { walkinItems = null; }
    }

    async function saveGpsLocation() {
      setLocSaving(true); setLocStatus(null);
      if (!navigator.geolocation) { setLocStatus("no_gps"); setLocSaving(false); return; }
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const r = await api.post("/api/v1/customers/location/save", {
            customerPhone: order.customerPhone,
            customerAddress: order.deliveryAddress,
            latitude, longitude,
            locationAccuracy: accuracy && accuracy <= 50 ? "EXACT" : "APPROXIMATE",
            source: "STAFF_LOCATION",
          });
          setSavedLoc(r.data); setLocStatus("ok");
        } catch { setLocStatus("error"); }
        setLocSaving(false);
      }, () => { setLocStatus("no_gps"); setLocSaving(false); }, { enableHighAccuracy: true, timeout: 10000 });
    }

    const navLat = savedLoc?.latitude || order.deliveryLat;
    const navLng = savedLoc?.longitude || order.deliveryLng;

    return (
      <div style={{
        background: WHITE, borderRadius: 14, padding: 14, marginBottom: 10,
        boxShadow: isFirst ? "0 4px 16px rgba(244,123,32,.2)" : "0 2px 10px rgba(0,0,0,.07)",
        border: isFirst ? `2px solid ${ORANGE}` : "1px solid #E5E7EB",
      }}>
        {/* Route badge + header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {routeIndex !== undefined && sortedActiveOrders.length > 1 && (
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: routeIndex === 0 ? ORANGE : NAVY,
                color: WHITE, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900,
              }}>{routeIndex + 1}</div>
            )}
            <div>
              <span style={{ fontSize: 14, fontWeight: 900, color: ORANGE }}>{order.orderNumber}</span>
              {isFirst && <span style={{ marginLeft: 6, fontSize: 10, background: "#FFF7ED", color: ORANGE, borderRadius: 6, padding: "2px 6px", fontWeight: 800 }}>ไปก่อนเลย!</span>}
              <div style={{ marginTop: 2 }}>
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, fontWeight: 700,
                  background: nextAction?.bg || "#F3F4F6", color: nextAction?.color || GRAY }}>
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>฿{Number(order.total).toLocaleString()}</span>
        </div>

        {/* Info */}
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          <p><span style={{ color: GRAY }}>👤</span> <strong>{order.customerName || "ไม่ระบุ"}</strong>{order.customerPhone ? ` · ${order.customerPhone}` : ""}</p>
          {walkinItems ? (
            <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "6px 10px" }}>
              {walkinItems.map((it, i) => (
                <p key={i} style={{ margin: 0, color: "#166534", fontSize: 12 }}>
                  🛢 {it.label || it.name || `${it.brandName || ""} ${it.weightKg ? it.weightKg + "กก." : ""}`.trim()} × {it.qty || 1}
                  {it.price ? ` · ฿${Number(it.price).toLocaleString()}` : ""}
                </p>
              ))}
            </div>
          ) : (
            <p><span style={{ color: GRAY }}>🛢</span> {order.product?.name || ""}{order.brand?.name ? ` (${order.brand.name})` : ""} × {order.qty}</p>
          )}
          <p style={{ color: GRAY, lineHeight: 1.4 }}>📍 {order.deliveryAddress}</p>
          {savedLoc?.locationName && <p style={{ color: "#0369A1", fontSize: 12 }}>🏠 {savedLoc.locationName}</p>}
          {savedLoc?.locationNote && <p style={{ color: "#374151", fontSize: 12, background: "#EFF6FF", borderRadius: 6, padding: "4px 8px" }}>📝 {savedLoc.locationNote}</p>}
          {userNote && <p style={{ color: "#92400E", background: "#FFF7ED", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>💬 {userNote}</p>}
        </div>

        {/* GPS Save button */}
        {order.customerPhone && order.deliveryAddress && order.deliveryAddress !== "หน้าร้าน" && (
          <div style={{ marginBottom: 10, background: "#F0F9FF", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: savedLoc ? "#0369A1" : GRAY }}>
                {savedLoc ? "📍 มีพิกัดแล้ว" : "📍 ยังไม่มีพิกัด"}
              </span>
              {locStatus === "ok"     && <span style={{ fontSize: 11, color: "#059669", marginLeft: 6 }}>✅ บันทึกแล้ว</span>}
              {locStatus === "no_gps" && <span style={{ fontSize: 11, color: "#D97706", marginLeft: 6 }}>⚠️ เปิด GPS ก่อน</span>}
              {locStatus === "error"  && <span style={{ fontSize: 11, color: "#DC2626", marginLeft: 6 }}>❌ ผิดพลาด</span>}
            </div>
            <button onClick={saveGpsLocation} disabled={locSaving} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: locSaving ? "#E5E7EB" : "#0369A1", color: WHITE,
              fontSize: 12, fontWeight: 700, cursor: locSaving ? "default" : "pointer", whiteSpace: "nowrap",
            }}>{locSaving ? "⏳..." : "📍 บันทึกที่นี่"}</button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          {navLat && (
            <button onClick={() => openNavigation(navLat, navLng)} style={{
              flex: 1, padding: "10px 6px", borderRadius: 10, border: "none",
              background: "#1D4ED8", color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>🧭 นำทาง</button>
          )}
          {showAccept && (
            <button onClick={() => acceptOrder(order.id)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: ORANGE, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>{updating === order.id ? "..." : "✋ รับงาน"}</button>
          )}
          {showStatus && nextAction && (
            <button onClick={() => updateStatus(order.id, nextAction.next)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: nextAction.next === "delivered" ? "#059669" : NAVY,
              color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>{updating === order.id ? "..." : nextAction.label}</button>
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
            <div style={{ color: WHITE, fontWeight: 900, fontSize: 18 }}>🛵 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span></div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>พนักงาน: {user.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: location ? "#34D399" : "#FCA5A5", background: "rgba(255,255,255,.1)", padding: "3px 8px", borderRadius: 6 }}>
              {location ? "📡 GPS ON" : "📡 GPS OFF"}
            </span>
            <button onClick={logout} style={{ background: "rgba(255,255,255,.15)", border: "none", color: WHITE, padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>ออก</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.key ? WHITE : "rgba(255,255,255,.12)",
              color: tab === t.key ? NAVY : "rgba(255,255,255,.7)",
              fontSize: 11, fontWeight: tab === t.key ? 800 : 400, transition: "all .15s",
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

      <div style={{ padding: "14px 14px 80px" }}>

        {/* Pending */}
        {tab === "pending" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>ออเดอร์รอรับงาน · {pendingOrders.length} รายการ</p>
            {pendingOrders.map(o => <OrderCard key={o.id} order={o} showAccept />)}
            {!pendingOrders.length && <EmptyState icon="📭" text="ไม่มีออเดอร์รอรับงาน" />}
          </>
        )}

        {/* Active — with route order */}
        {tab === "active" && (
          <>
            {/* Route summary banner */}
            {sortedActiveOrders.length > 1 && (
              <div style={{ background: "#EEF2FF", borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>
                    {routeLoading ? "🔄 กำลังคำนวณเส้นทาง..." : "🗺 เส้นทางที่เร็วที่สุด"}
                  </div>
                  {!routeLoading && (
                    <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>
                      {sortedActiveOrders.map((o, i) => `${i + 1}. ${o.customerName}`).join(" → ")}
                    </div>
                  )}
                </div>
                {sortedActiveOrders.length >= 2 && (
                  <button onClick={openFullRoute} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: NAVY, color: WHITE, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    เปิด Maps
                  </button>
                )}
              </div>
            )}
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>
              ออเดอร์ที่รับแล้ว · {myOrders.length} รายการ
              {!location && myOrders.length > 1 && <span style={{ color: "#F59E0B" }}> · เปิด GPS เพื่อเส้นทางที่แม่นยำขึ้น</span>}
            </p>
            {sortedActiveOrders.map((o, i) => <OrderCard key={o.id} order={o} showStatus routeIndex={i} />)}
            {!myOrders.length && <EmptyState icon="✅" text="ไม่มีออเดอร์ที่กำลังส่ง" />}
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
    <div style={{ textAlign: "center", padding: "50px 20px", color: GRAY }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{text}</p>
    </div>
  );
}
