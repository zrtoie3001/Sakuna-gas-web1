import { useState, useEffect, useCallback, useRef } from "react";
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

// ─── Leaflet loader (singleton) ───────────────────────────────────────────────
let leafletLoaded = false;
function ensureLeaflet(cb) {
  if (window.L) { cb(); return; }
  if (leafletLoaded) {
    const iv = setInterval(() => { if (window.L) { clearInterval(iv); cb(); } }, 100);
    return;
  }
  leafletLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  document.head.appendChild(link);
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
  script.onload = cb;
  document.head.appendChild(script);
}

// ─── MapModal — module-level so React never remounts it during zoom ───────────
function MapModal({ order, savedLoc, onClose, onSavePin }) {
  const mapRef       = useRef(null);
  const mapObjRef    = useRef(null);
  const pinMarkerRef = useRef(null);
  const gpsMarkerRef = useRef(null);
  const [pinLat, setPinLat]     = useState(null);
  const [pinLng, setPinLng]     = useState(null);
  const [gpsStatus, setGpsStatus] = useState("loading");
  const [mapReady, setMapReady]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  function placePinMarker(map, lat, lng, label) {
    if (pinMarkerRef.current) pinMarkerRef.current.remove();
    const icon = window.L.divIcon({
      className: "",
      html: `<div style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">📍</div>`,
      iconSize: [30, 30], iconAnchor: [15, 30],
    });
    pinMarkerRef.current = window.L.marker([lat, lng], { icon, draggable: true })
      .addTo(map).bindPopup(label || "📍 ตำแหน่งลูกค้า").openPopup();
    pinMarkerRef.current.on("dragend", e => {
      const p = e.target.getLatLng();
      setPinLat(p.lat); setPinLng(p.lng);
    });
    setPinLat(lat); setPinLng(lng);
  }

  function placeGpsMarker(map, lat, lng) {
    if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
    const icon = window.L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#1D4ED8;border:3px solid #fff;box-shadow:0 2px 10px rgba(29,78,216,.7)"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    gpsMarkerRef.current = window.L.marker([lat, lng], { icon, zIndexOffset: -100 })
      .addTo(map).bindPopup("📡 ตำแหน่งของคุณ");
  }

  function initMap(centerLat, centerLng, zoom) {
    if (mapObjRef.current || !mapRef.current || !window.L) return;
    const map = window.L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLng], zoom);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;
    setMapReady(true);
    map.on("click", e => {
      placePinMarker(map, e.latlng.lat, e.latlng.lng, "📍 ตำแหน่งที่เลือก");
    });
    return map;
  }

  useEffect(() => {
    const hasSaved   = !!(savedLoc?.latitude);
    const hasDelivery = !!(order.deliveryLat);

    ensureLeaflet(() => {
      if (hasSaved || hasDelivery) {
        // Have existing coords → init map there immediately, then also fetch GPS
        const lat = Number(hasSaved ? savedLoc.latitude : order.deliveryLat);
        const lng = Number(hasSaved ? savedLoc.longitude : order.deliveryLng);
        const map = initMap(lat, lng, 17);
        if (map) placePinMarker(map, lat, lng, savedLoc?.locationName || order.deliveryAddress || "ตำแหน่งลูกค้า");

        // Still get GPS to show blue dot
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            placeGpsMarker(mapObjRef.current, pos.coords.latitude, pos.coords.longitude);
            setGpsStatus("ok");
          }, () => setGpsStatus("error"), { enableHighAccuracy: true, timeout: 10000 });
        } else setGpsStatus("error");

      } else {
        // No existing coords → GET GPS FIRST, then init map centered there
        if (!navigator.geolocation) {
          setGpsStatus("error");
          initMap(13.75, 100.5, 11); // Bangkok fallback
          return;
        }
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: glat, longitude: glng } = pos.coords;
          setGpsStatus("ok");
          const map = initMap(glat, glng, 17);
          if (map) {
            placeGpsMarker(map, glat, glng);
            // Auto-place customer pin at GPS so save button is ready
            placePinMarker(map, glat, glng, "📍 ตำแหน่งปัจจุบัน (เลื่อนหมุดได้)");
          }
        }, () => {
          setGpsStatus("error");
          initMap(13.75, 100.5, 11);
        }, { enableHighAccuracy: true, timeout: 10000 });
      }
    });

    return () => {
      if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null; }
    };
  }, []);

  function goToMyGps() {
    if (gpsMarkerRef.current) {
      const p = gpsMarkerRef.current.getLatLng();
      mapObjRef.current?.setView([p.lat, p.lng], 17);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: glat, longitude: glng } = pos.coords;
        if (mapObjRef.current) {
          placeGpsMarker(mapObjRef.current, glat, glng);
          mapObjRef.current.setView([glat, glng], 17);
        }
        setGpsStatus("ok");
      }, () => setGpsStatus("error"), { enableHighAccuracy: true, timeout: 8000 });
    }
  }

  async function savePin() {
    if (!pinLat || !pinLng) return;
    setSaving(true);
    try {
      const r = await api.post("/api/v1/customers/location/save", {
        customerPhone: order.customerPhone,
        customerAddress: order.deliveryAddress,
        latitude: pinLat, longitude: pinLng,
        locationAccuracy: "APPROXIMATE",
        source: "CUSTOMER_MAP_PIN",
      });
      setSaved(true);
      onSavePin(r.data);
    } catch {}
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: WHITE, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>🗺️ แผนที่ลูกค้า</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.customerName} · {order.deliveryAddress}
          </div>
        </div>
        {pinLat && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${pinLat},${pinLng}`} target="_blank" rel="noreferrer"
            style={{ padding: "6px 10px", borderRadius: 8, background: "#1D4ED8", color: WHITE, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            🧭 นำทาง
          </a>
        )}
      </div>

      {/* Map */}
      <div style={{ position: "relative", flex: 1 }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

        {/* GPS loading overlay */}
        {!mapReady && (
          <div style={{ position: "absolute", inset: 0, background: "#1a1a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ color: WHITE, fontSize: 14, fontWeight: 700 }}>กำลังหาตำแหน่ง GPS...</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 6 }}>อนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์</div>
          </div>
        )}

        {/* GPS re-center button */}
        {mapReady && (
          <button onClick={goToMyGps} style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 500,
            width: 46, height: 46, borderRadius: "50%", border: "none",
            background: WHITE, boxShadow: "0 2px 10px rgba(0,0,0,.35)",
            fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {gpsStatus === "loading" ? "⏳" : gpsStatus === "error" ? "📵" : "📡"}
          </button>
        )}

        {mapReady && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 500, background: "rgba(0,0,0,.6)", color: WHITE, fontSize: 11, padding: "5px 12px", borderRadius: 20, pointerEvents: "none", whiteSpace: "nowrap" }}>
            แตะแผนที่เพื่อปักหมุด · ลากหมุดเพื่อเลื่อน
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: WHITE, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <div style={{ flex: 1, fontSize: 12, color: GRAY, minWidth: 0 }}>
          {pinLat
            ? <span style={{ color: "#059669" }}>📍 {Number(pinLat).toFixed(5)}, {Number(pinLng).toFixed(5)}</span>
            : <span>{gpsStatus === "loading" ? "⏳ รอ GPS..." : "แตะบนแผนที่เพื่อปักหมุด"}</span>}
          {savedLoc?.locationName && <div style={{ color: "#0369A1", fontWeight: 700, marginTop: 2 }}>🏠 {savedLoc.locationName}</div>}
        </div>
        {saved ? (
          <span style={{ fontSize: 13, color: "#059669", fontWeight: 700, whiteSpace: "nowrap" }}>✅ บันทึกแล้ว</span>
        ) : (
          <button onClick={savePin} disabled={!pinLat || saving} style={{
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: !pinLat ? "#E5E7EB" : ORANGE,
            color: !pinLat ? GRAY : WHITE, fontSize: 13, fontWeight: 700,
            cursor: !pinLat ? "default" : "pointer", whiteSpace: "nowrap",
          }}>{saving ? "⏳..." : "📍 บันทึกหมุด"}</button>
        )}
      </div>
    </div>
  );
}

// ─── OrderCard — module-level to prevent remount on parent re-render ──────────
function OrderCard({ order, showAccept, showStatus, routeIndex, sortedActiveOrdersLen, updating, onAccept, onUpdateStatus, onNavigate }) {
  const nextAction = STATUS_NEXT[order.status];
  const isFirst = routeIndex === 0 && sortedActiveOrdersLen > 1;
  const [savedLoc, setSavedLoc] = useState(null);
  const [locSaving, setLocSaving] = useState(false);
  const [locStatus, setLocStatus] = useState(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!order.customerPhone) return;
    api.get(`/api/v1/customers/location/by-contact?phone=${encodeURIComponent(order.customerPhone)}`)
      .then(r => setSavedLoc(r.data || null)).catch(() => {});
  }, [order.customerPhone]);

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
    <>
      {showMap && (
        <MapModal
          order={order}
          savedLoc={savedLoc}
          onClose={() => setShowMap(false)}
          onSavePin={loc => { setSavedLoc(loc); setShowMap(false); }}
        />
      )}
      <div style={{
        background: WHITE, borderRadius: 14, padding: 14, marginBottom: 10,
        boxShadow: isFirst ? "0 4px 16px rgba(244,123,32,.2)" : "0 2px 10px rgba(0,0,0,.07)",
        border: isFirst ? `2px solid ${ORANGE}` : "1px solid #E5E7EB",
      }}>
        {/* Route badge + header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {routeIndex !== undefined && sortedActiveOrdersLen > 1 && (
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
          <button onClick={() => {
            if (navLat) {
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=driving`, "_blank");
            } else if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                window.open(`https://www.google.com/maps/@${latitude},${longitude},17z`, "_blank");
              }, () => {
                window.open("https://www.google.com/maps", "_blank");
              }, { enableHighAccuracy: true, timeout: 8000 });
            } else {
              window.open("https://www.google.com/maps", "_blank");
            }
          }} style={{
            flex: 1, padding: "10px 6px", borderRadius: 10, border: "none",
            background: "#1D4ED8", color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{navLat ? "🧭 นำทาง" : "🗺️ Maps"}</button>
          <button onClick={() => setShowMap(true)} style={{
            flex: 1, padding: "10px 6px", borderRadius: 10,
            background: "#F0F9FF", color: "#0369A1", fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: "1.5px solid #BAE6FD",
          }}>📍 ปักหมุด</button>
          {showAccept && (
            <button onClick={() => onAccept(order.id)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: ORANGE, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>{updating === order.id ? "..." : "✋ รับงาน"}</button>
          )}
          {showStatus && nextAction && (
            <button onClick={() => onUpdateStatus(order.id, nextAction.next)} disabled={updating === order.id} style={{
              flex: 2, padding: "10px 6px", borderRadius: 10, border: "none",
              background: nextAction.next === "delivered" ? "#059669" : NAVY,
              color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: updating === order.id ? 0.6 : 1,
            }}>{updating === order.id ? "..." : nextAction.label}</button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab]             = useState("pending");
  const [pendingOrders, setPending] = useState([]);
  const [myOrders, setMyOrders]   = useState([]);
  const [doneOrders, setDone]     = useState([]);
  const [updating, setUpdating]   = useState(null);
  const [location, setLocation]   = useState(null);
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

  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setLocation({ lat, lng });
      api.put("/api/v1/drivers/location", { lat, lng }).catch(() => {});
    }, null, { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  useEffect(() => {
    const activeOrders = myOrders.filter(o => o.status === "out_for_delivery" || o.status === "preparing");
    if (activeOrders.length < 2) { setRouteOrder(activeOrders.map(o => o.id)); return; }
    const lat = location?.lat || 13.8;
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

        {tab === "pending" && (
          <>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 10 }}>ออเดอร์รอรับงาน · {pendingOrders.length} รายการ</p>
            {pendingOrders.map(o => (
              <OrderCard key={o.id} order={o} showAccept
                sortedActiveOrdersLen={0} updating={updating}
                onAccept={acceptOrder} onUpdateStatus={updateStatus} onNavigate={openNavigation} />
            ))}
            {!pendingOrders.length && <EmptyState icon="📭" text="ไม่มีออเดอร์รอรับงาน" />}
          </>
        )}

        {tab === "active" && (
          <>
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
            {sortedActiveOrders.map((o, i) => (
              <OrderCard key={o.id} order={o} showStatus routeIndex={i}
                sortedActiveOrdersLen={sortedActiveOrders.length} updating={updating}
                onAccept={acceptOrder} onUpdateStatus={updateStatus} onNavigate={openNavigation} />
            ))}
            {!myOrders.length && <EmptyState icon="✅" text="ไม่มีออเดอร์ที่กำลังส่ง" />}
          </>
        )}

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
