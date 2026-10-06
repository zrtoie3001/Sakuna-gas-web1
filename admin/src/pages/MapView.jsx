import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

const STATUS_LABEL = {
  pending: "รอรับงาน", preparing: "เตรียมสินค้า",
  out_for_delivery: "กำลังส่ง", near_destination: "ใกล้ถึง",
  delivered: "ส่งสำเร็จ", cancelled: "ยกเลิก",
};
const STATUS_COLOR = {
  pending: "#F59E0B", preparing: "#3B82F6", out_for_delivery: "#06B6D4",
  near_destination: "#10B981", delivered: "#059669", cancelled: "#9CA3AF",
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor TSP heuristic — returns indices of `points` in visit order
function nearestNeighbor(startLat, startLng, points) {
  const remaining = points.map((_, i) => i);
  const order = [];
  let curLat = startLat, curLng = startLng;
  while (remaining.length) {
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((pi, ri) => {
      const d = haversine(curLat, curLng, points[pi].lat, points[pi].lng);
      if (d < bestDist) { bestDist = d; bestIdx = ri; }
    });
    order.push(remaining[bestIdx]);
    curLat = points[remaining[bestIdx]].lat;
    curLng = points[remaining[bestIdx]].lng;
    remaining.splice(bestIdx, 1);
  }
  return order;
}

export default function MapView() {
  const mapRef       = useRef(null);
  const mapObjRef    = useRef(null);
  const markersRef   = useRef([]);
  const routeLineRef = useRef(null);
  const gpsMarkerRef = useRef(null);
  const gpsLatRef    = useRef(null);
  const gpsLngRef    = useRef(null);
  const searchTimer  = useRef(null);

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);
  const [searchQ, setSearchQ]     = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [routeOrder, setRouteOrder] = useState(null); // null = ยังไม่คำนวณ, array = ลำดับที่เรียงแล้ว
  const [routeMode, setRouteMode]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setRouteOrder(null); setRouteMode(false);
    api.get("/api/v1/customers/locations/today-map")
      .then(r => setOrders(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    if (document.getElementById("leaflet-css")) { initMap(); return; }
    const link = document.createElement("link");
    link.id = "leaflet-css"; link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, []);

  function initMap() {
    if (mapObjRef.current || !mapRef.current || !window.L) return;
    const map = window.L.map(mapRef.current, { zoomControl: true }).setView([13.75, 100.5], 11);
    window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: "© Esri © OpenStreetMap contributors", maxZoom: 20, maxNativeZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        gpsLatRef.current = lat; gpsLngRef.current = lng;
        if (!mapObjRef.current) return;
        if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
        const icon = window.L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#1D4ED8;border:3px solid #fff;box-shadow:0 2px 8px rgba(29,78,216,.7)"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        gpsMarkerRef.current = window.L.marker([lat, lng], { icon, zIndexOffset: -100 })
          .addTo(mapObjRef.current).bindPopup("📡 ตำแหน่งของคุณ");
      }, () => {}, { enableHighAccuracy: true, timeout: 10000 });
    }
  }

  function handleSearch(q) {
    setSearchQ(q); setSearchRes([]);
    clearTimeout(searchTimer.current);
    if (!q.trim()) return;
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://search.longdo.com/mapsearch/json/search?keyword=${encodeURIComponent(q)}&key=5db9dd8bb58e53564cafa949ba22c267&limit=6`);
        const data = await r.json();
        setSearchRes(data.data || []);
      } catch {}
      setSearching(false);
    }, 500);
  }

  function pickSearchResult(item) {
    setSearchRes([]); setSearchQ("");
    if (mapObjRef.current) mapObjRef.current.setView([Number(item.lat), Number(item.lon)], 17);
  }

  function calcRoute() {
    const pts = withLoc.map(o => ({ lat: Number(o.savedLat || o.deliveryLat), lng: Number(o.savedLng || o.deliveryLng) }));
    if (!pts.length) return;
    const startLat = gpsLatRef.current ?? pts[0].lat;
    const startLng = gpsLngRef.current ?? pts[0].lng;
    const order = nearestNeighbor(startLat, startLng, pts);
    setRouteOrder(order);
    setRouteMode(true);
  }

  function clearRoute() {
    setRouteOrder(null); setRouteMode(false);
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
  }

  // Google Maps multi-stop navigation URL
  function googleMapsRouteUrl(orderedOrders) {
    if (!orderedOrders.length) return "#";
    const origin = gpsLatRef.current
      ? `${gpsLatRef.current},${gpsLngRef.current}`
      : (() => { const o = orderedOrders[0]; return `${Number(o.savedLat||o.deliveryLat)},${Number(o.savedLng||o.deliveryLng)}`; })();
    const dest = orderedOrders[orderedOrders.length - 1];
    const destStr = `${Number(dest.savedLat||dest.deliveryLat)},${Number(dest.savedLng||dest.deliveryLng)}`;
    const waypoints = orderedOrders.slice(0, -1).map(o =>
      `${Number(o.savedLat||o.deliveryLat)},${Number(o.savedLng||o.deliveryLng)}`
    ).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}${waypoints ? `&waypoints=${waypoints}` : ""}`;
  }

  // Draw markers + route line whenever orders or routeOrder changes
  useEffect(() => {
    const L = window.L; const map = mapObjRef.current;
    if (!L || !map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }

    const displayList = routeOrder ? routeOrder.map(i => withLoc[i]) : withLoc;

    displayList.forEach((o, displayIdx) => {
      const lat = Number(o.savedLat || o.deliveryLat);
      const lng = Number(o.savedLng || o.deliveryLng);
      if (!lat || !lng) return;

      const stopNum = displayIdx + 1;
      const color = routeMode ? ORANGE : (STATUS_COLOR[o.status] || GRAY);
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;">${stopNum}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      const m = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:190px;font-family:sans-serif">
            ${routeMode ? `<div style="font-size:11px;font-weight:700;color:${ORANGE};margin-bottom:4px">จุดที่ ${stopNum}</div>` : ""}
            <div style="font-weight:800;font-size:13px;margin-bottom:4px">${o.customerName || "ไม่ระบุ"}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:2px">📞 ${o.customerPhone || "-"}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:4px">📍 ${o.deliveryAddress || "-"}</div>
            ${o.locationName ? `<div style="font-size:11px;color:#0369A1;margin-bottom:2px">🏠 ${o.locationName}</div>` : ""}
            ${o.locationNote ? `<div style="font-size:11px;color:#374151;margin-bottom:4px">📝 ${o.locationNote}</div>` : ""}
            <div style="font-size:11px;margin-bottom:6px">฿${Number(o.total).toLocaleString()} · ${STATUS_LABEL[o.status] || o.status}</div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="font-size:12px;font-weight:700;color:#7C3AED">🧭 นำทางจุดนี้</a>
          </div>
        `);
      m.on("click", () => setSelected(o));
      markersRef.current.push(m);
    });

    // Draw route polyline
    if (routeMode && displayList.length > 1) {
      const latlngs = [];
      if (gpsLatRef.current) latlngs.push([gpsLatRef.current, gpsLngRef.current]);
      displayList.forEach(o => {
        const lat = Number(o.savedLat || o.deliveryLat);
        const lng = Number(o.savedLng || o.deliveryLng);
        if (lat && lng) latlngs.push([lat, lng]);
      });
      routeLineRef.current = L.polyline(latlngs, {
        color: ORANGE, weight: 3, opacity: 0.8, dashArray: "8 5",
      }).addTo(map);
    }

    const pts = displayList.filter(o => Number(o.savedLat || o.deliveryLat));
    if (pts.length > 0) {
      const bounds = L.latLngBounds(pts.map(o => [Number(o.savedLat || o.deliveryLat), Number(o.savedLng || o.deliveryLng)]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, routeOrder, routeMode]);

  const withLoc    = orders.filter(o => o.savedLat || o.deliveryLat);
  const withoutLoc = orders.filter(o => !o.savedLat && !o.deliveryLat);
  const orderedList = routeOrder ? routeOrder.map(i => withLoc[i]) : withLoc;

  // Total distance estimate
  const totalKm = routeOrder ? (() => {
    let km = 0;
    let prevLat = gpsLatRef.current ?? Number(orderedList[0]?.savedLat || orderedList[0]?.deliveryLat);
    let prevLng = gpsLngRef.current ?? Number(orderedList[0]?.savedLng || orderedList[0]?.deliveryLng);
    orderedList.forEach(o => {
      const lat = Number(o.savedLat || o.deliveryLat);
      const lng = Number(o.savedLng || o.deliveryLng);
      km += haversine(prevLat, prevLng, lat, lng);
      prevLat = lat; prevLng = lng;
    });
    return km.toFixed(1);
  })() : null;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", gap: 0, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 300, minWidth: 300, background: WHITE, borderRight: "1px solid #E5E7EB", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, color: NAVY, marginBottom: 8 }}>🗺️ แผนที่งานจัดส่งวันนี้</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />

          {/* Route button */}
          {withLoc.length > 0 && (
            !routeMode ? (
              <button onClick={calcRoute} style={{
                width: "100%", padding: "9px", borderRadius: 9, border: "none",
                background: ORANGE, color: WHITE, fontSize: 13, fontWeight: 800, cursor: "pointer",
              }}>🛣️ คำนวณเส้นทางที่ดีที่สุด</button>
            ) : (
              <div>
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 9, padding: "8px 12px", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>🛣️ เส้นทางที่แนะนำ</div>
                  <div style={{ fontSize: 11, color: "#78350F", marginTop: 2 }}>ระยะทางโดยประมาณ ~{totalKm} กม. · {withLoc.length} จุด</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={googleMapsRouteUrl(orderedList)} target="_blank" rel="noreferrer"
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "#10B981", color: WHITE, fontSize: 12, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>
                    🧭 เปิด Google Maps
                  </a>
                  <button onClick={clearRoute} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: WHITE, fontSize: 12, color: GRAY, cursor: "pointer" }}>
                    ✕ ล้าง
                  </button>
                </div>
              </div>
            )
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: GRAY }}>
            {loading ? "กำลังโหลด..." : `${withLoc.length} รายการมีพิกัด · ${withoutLoc.length} ไม่มีพิกัด`}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {orderedList.map((o, idx) => (
            <div key={o.id} onClick={() => {
              setSelected(o);
              const lat = Number(o.savedLat || o.deliveryLat);
              const lng = Number(o.savedLng || o.deliveryLng);
              if (mapObjRef.current && lat) mapObjRef.current.setView([lat, lng], 16);
            }} style={{
              padding: "10px 14px", borderBottom: "1px solid #F3F4F6", cursor: "pointer",
              background: selected?.id === o.id ? "#EEF2FF" : WHITE,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: routeMode ? ORANGE : (STATUS_COLOR[o.status] || GRAY),
                  color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
                }}>{idx + 1}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{o.customerName || "ไม่ระบุ"}</div>
                  <div style={{ fontSize: 11, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.deliveryAddress || "-"}</div>
                  {o.locationName && <div style={{ fontSize: 11, color: "#0369A1" }}>🏠 {o.locationName}</div>}
                  <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: routeMode ? ORANGE : (STATUS_COLOR[o.status] || GRAY), fontWeight: 700 }}>
                      {routeMode ? `จุดที่ ${idx + 1}` : (STATUS_LABEL[o.status] || o.status)}
                    </span>
                    <span style={{ color: GRAY }}>฿{Number(o.total).toLocaleString()}</span>
                  </div>
                </div>
                {routeMode && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${Number(o.savedLat||o.deliveryLat)},${Number(o.savedLng||o.deliveryLng)}`}
                    target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, color: "#7C3AED", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", padding: "4px 6px", background: "#F3F0FF", borderRadius: 6 }}>
                    🧭
                  </a>
                )}
              </div>
            </div>
          ))}

          {withoutLoc.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: "1px solid #F3F4F6", background: "#FFF7ED" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>🔴 ไม่มีพิกัด ({withoutLoc.length} รายการ)</div>
              {withoutLoc.map(o => (
                <div key={o.id} style={{ fontSize: 11, color: "#92400E", padding: "3px 0" }}>
                  · {o.customerName || "ไม่ระบุ"} — {o.deliveryAddress || "-"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        <div style={{ background: WHITE, padding: "8px 12px", borderBottom: "1px solid #E5E7EB", position: "relative", zIndex: 600, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F3F4F6", borderRadius: 10, padding: "7px 12px" }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input value={searchQ} onChange={e => handleSearch(e.target.value)}
              placeholder="ค้นหาถนน ซอย สถานที่..."
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, outline: "none" }} />
            {searching && <span style={{ fontSize: 12, color: GRAY }}>⏳</span>}
            {searchQ && <button onClick={() => { setSearchQ(""); setSearchRes([]); }} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: GRAY }}>✕</button>}
          </div>
          {searchRes.length > 0 && (
            <div style={{ position: "absolute", left: 12, right: 12, top: "100%", background: WHITE, borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,.15)", maxHeight: 240, overflowY: "auto", zIndex: 700 }}>
              {searchRes.map((item, i) => (
                <div key={i} onMouseDown={() => pickSearchResult(item)}
                  style={{ padding: "9px 14px", borderBottom: i < searchRes.length-1 ? "1px solid #F3F4F6" : "none", cursor: "pointer", fontSize: 13, color: "#1F2937" }}>
                  📍 {item.name}{item.address ? ` — ${item.address}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
        <div ref={mapRef} style={{ flex: 1 }} />
      </div>
    </div>
  );
}
