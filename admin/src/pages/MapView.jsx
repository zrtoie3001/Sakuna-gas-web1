import { useState, useEffect, useRef } from "react";
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

export default function MapView() {
  const mapRef     = useRef(null);
  const mapObjRef  = useRef(null);
  const markersRef = useRef([]);
  const gpsMarkerRef = useRef(null);
  const searchTimer  = useRef(null);
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQ, setSearchQ]     = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/api/v1/customers/locations/today-map")
      .then(r => setOrders(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  // Load Leaflet CSS + JS once
  useEffect(() => {
    if (document.getElementById("leaflet-css")) { initMap(); return; }
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
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
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://carto.com/">CARTO</a> © OSM', maxZoom: 20, maxNativeZoom: 19,
    }).addTo(map);
    mapObjRef.current = map;
    // Show GPS blue dot
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
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
    const lat = Number(item.lat); const lng = Number(item.lon);
    setSearchRes([]); setSearchQ("");
    if (mapObjRef.current) mapObjRef.current.setView([lat, lng], 17);
  }

  // Re-render markers whenever orders change
  useEffect(() => {
    const L = window.L;
    const map = mapObjRef.current;
    if (!L || !map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const withLoc = orders.filter(o => o.savedLat || o.deliveryLat);
    withLoc.forEach((o, idx) => {
      const lat = Number(o.savedLat || o.deliveryLat);
      const lng = Number(o.savedLng || o.deliveryLng);
      if (!lat || !lng) return;

      const color = STATUS_COLOR[o.status] || GRAY;
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;">${idx + 1}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const m = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px;font-family:sans-serif">
            <div style="font-weight:800;font-size:13px;margin-bottom:4px">${o.customerName || "ไม่ระบุ"}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:2px">📞 ${o.customerPhone || "-"}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:4px">📍 ${o.deliveryAddress || "-"}</div>
            ${o.locationName ? `<div style="font-size:11px;color:#0369A1;margin-bottom:2px">🏠 ${o.locationName}</div>` : ""}
            ${o.locationNote ? `<div style="font-size:11px;color:#374151;margin-bottom:4px">📝 ${o.locationNote}</div>` : ""}
            <div style="font-size:11px;margin-bottom:4px">฿${Number(o.total).toLocaleString()} · ${STATUS_LABEL[o.status] || o.status}</div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="font-size:12px;font-weight:700;color:#7C3AED">🧭 นำทาง</a>
          </div>
        `);
      m.on("click", () => setSelected(o));
      markersRef.current.push(m);
    });

    if (withLoc.length > 0) {
      const bounds = L.latLngBounds(withLoc.map(o => [
        Number(o.savedLat || o.deliveryLat), Number(o.savedLng || o.deliveryLng),
      ]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [orders]);

  const withLoc    = orders.filter(o => o.savedLat || o.deliveryLat);
  const withoutLoc = orders.filter(o => !o.savedLat && !o.deliveryLat);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", gap: 0, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 300, minWidth: 300, background: WHITE, borderRight: "1px solid #E5E7EB", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #F3F4F6" }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY, marginBottom: 8 }}>🗺️ แผนที่งานจัดส่งวันนี้</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }} />
          <div style={{ marginTop: 8, fontSize: 12, color: GRAY }}>
            {loading ? "กำลังโหลด..." : `${withLoc.length} รายการมีพิกัด · ${withoutLoc.length} ไม่มีพิกัด`}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {withLoc.map((o, idx) => (
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
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: STATUS_COLOR[o.status] || GRAY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{idx + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{o.customerName || "ไม่ระบุ"}</div>
                  <div style={{ fontSize: 11, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.deliveryAddress || "-"}</div>
                  {o.locationName && <div style={{ fontSize: 11, color: "#0369A1" }}>🏠 {o.locationName}</div>}
                  <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 6 }}>
                    <span style={{ color: STATUS_COLOR[o.status] || GRAY, fontWeight: 700 }}>{STATUS_LABEL[o.status] || o.status}</span>
                    <span style={{ color: GRAY }}>฿{Number(o.total).toLocaleString()}</span>
                  </div>
                </div>
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
        {/* Search bar */}
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
        {!window.L && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: GRAY, fontSize: 14 }}>
            กำลังโหลดแผนที่...
          </div>
        )}
      </div>
    </div>
  );
}
