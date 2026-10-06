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

// Palette for different drivers (up to 8)
const DRIVER_COLORS = ["#F47B20","#7C3AED","#0EA5E9","#10B981","#EF4444","#EC4899","#F59E0B","#6366F1"];

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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
    curLat = points[remaining[bestIdx]].lat; curLng = points[remaining[bestIdx]].lng;
    remaining.splice(bestIdx, 1);
  }
  return order;
}

export default function MapView() {
  const mapRef       = useRef(null);
  const mapObjRef    = useRef(null);
  const markersRef   = useRef([]);
  const routeLineRef = useRef([]);
  const gpsMarkerRef = useRef(null);
  const gpsLatRef    = useRef(null);
  const gpsLngRef    = useRef(null);
  const searchTimer  = useRef(null);

  const [orders, setOrders]       = useState([]);
  const [drivers, setDrivers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [date, setDate]           = useState(new Date().toISOString().split("T")[0]);
  const [searchQ, setSearchQ]     = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [driverFilter, setDriverFilter] = useState("all"); // "all" | driverId | "unassigned"
  const [routeOrder, setRouteOrder]     = useState(null);
  const [routeMode, setRouteMode]       = useState(false);
  const [assignModal, setAssignModal]   = useState(null); // order object
  const [assigningId, setAssigningId]   = useState(null);

  const loadOrders = () => {
    setLoading(true);
    setRouteOrder(null); setRouteMode(false);
    api.get("/api/v1/customers/locations/today-map")
      .then(r => setOrders(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, [date]);

  useEffect(() => {
    api.get("/api/v1/drivers")
      .then(r => setDrivers(Array.isArray(r.data) ? r.data : r.data.drivers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (document.getElementById("leaflet-css")) { initMap(); return; }
    const link = document.createElement("link"); link.id = "leaflet-css"; link.rel = "stylesheet";
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
      attribution: "© Esri © OpenStreetMap", maxZoom: 20, maxNativeZoom: 19,
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
          iconSize: [16,16], iconAnchor: [8,8],
        });
        gpsMarkerRef.current = window.L.marker([lat,lng],{icon,zIndexOffset:-100}).addTo(mapObjRef.current).bindPopup("📡 ตำแหน่งของคุณ");
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

  // Unique drivers from today's orders
  const orderDrivers = [...new Map(orders.filter(o => o.driverId).map(o => [o.driverId, { id: o.driverId, name: o.driverName || "ไม่ระบุ" }])).values()];
  const driverColorMap = new Map(orderDrivers.map((d, i) => [d.id, DRIVER_COLORS[i % DRIVER_COLORS.length]]));

  // Filtered orders for current tab
  const filteredOrders = orders.filter(o => {
    if (driverFilter === "all") return true;
    if (driverFilter === "unassigned") return !o.driverId;
    return o.driverId === driverFilter;
  });
  const withLoc    = filteredOrders.filter(o => o.savedLat || o.deliveryLat);
  const withoutLoc = filteredOrders.filter(o => !o.savedLat && !o.deliveryLat);
  const orderedList = routeOrder ? routeOrder.map(i => withLoc[i]) : withLoc;

  function calcRoute() {
    const pts = withLoc.map(o => ({ lat: Number(o.savedLat||o.deliveryLat), lng: Number(o.savedLng||o.deliveryLng) }));
    if (!pts.length) return;
    const sLat = gpsLatRef.current ?? pts[0].lat;
    const sLng = gpsLngRef.current ?? pts[0].lng;
    setRouteOrder(nearestNeighbor(sLat, sLng, pts));
    setRouteMode(true);
  }

  function clearRoute() {
    setRouteOrder(null); setRouteMode(false);
    routeLineRef.current.forEach(l => l.remove()); routeLineRef.current = [];
  }

  function googleMapsRouteUrl(list) {
    if (!list.length) return "#";
    const origin = gpsLatRef.current ? `${gpsLatRef.current},${gpsLngRef.current}`
      : `${Number(list[0].savedLat||list[0].deliveryLat)},${Number(list[0].savedLng||list[0].deliveryLng)}`;
    const dest = list[list.length-1];
    const destStr = `${Number(dest.savedLat||dest.deliveryLat)},${Number(dest.savedLng||dest.deliveryLng)}`;
    const waypoints = list.slice(0,-1).map(o=>`${Number(o.savedLat||o.deliveryLat)},${Number(o.savedLng||o.deliveryLng)}`).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}${waypoints?`&waypoints=${waypoints}`:""}`;
  }

  async function assignDriver(orderId, driverId) {
    setAssigningId(orderId);
    try {
      await api.put(`/api/v1/orders/${orderId}/driver`, { driverId: driverId || null });
      await loadOrders();
      setAssignModal(null);
    } catch {}
    setAssigningId(null);
  }

  const totalKm = routeOrder ? (() => {
    let km=0, prevLat=gpsLatRef.current??Number(orderedList[0]?.savedLat||orderedList[0]?.deliveryLat), prevLng=gpsLngRef.current??Number(orderedList[0]?.savedLng||orderedList[0]?.deliveryLng);
    orderedList.forEach(o=>{ const lat=Number(o.savedLat||o.deliveryLat),lng=Number(o.savedLng||o.deliveryLng); km+=haversine(prevLat,prevLng,lat,lng); prevLat=lat; prevLng=lng; });
    return km.toFixed(1);
  })() : null;

  // Re-render markers
  useEffect(() => {
    const L = window.L, map = mapObjRef.current;
    if (!L || !map) return;
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    routeLineRef.current.forEach(l => l.remove()); routeLineRef.current = [];

    const displayList = routeOrder ? routeOrder.map(i => withLoc[i]) : withLoc;

    displayList.forEach((o, idx) => {
      const lat = Number(o.savedLat||o.deliveryLat), lng = Number(o.savedLng||o.deliveryLng);
      if (!lat || !lng) return;
      const color = routeMode ? (driverColorMap.get(o.driverId) || ORANGE) : (driverColorMap.get(o.driverId) || GRAY);
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;">${idx+1}</div>`,
        iconSize:[30,30], iconAnchor:[15,15],
      });
      const driverLine = o.driverName ? `<div style="font-size:11px;color:#7C3AED;margin-bottom:4px">🚴 ${o.driverName}</div>` : `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px">ยังไม่จ่ายงาน</div>`;
      const m = L.marker([lat,lng],{icon}).addTo(map).bindPopup(`
        <div style="min-width:190px;font-family:sans-serif">
          ${routeMode?`<div style="font-size:11px;font-weight:700;color:${color};margin-bottom:4px">จุดที่ ${idx+1}</div>`:""}
          <div style="font-weight:800;font-size:13px;margin-bottom:4px">${o.customerName||"ไม่ระบุ"}</div>
          ${driverLine}
          <div style="font-size:11px;color:#6B7280;margin-bottom:2px">📞 ${o.customerPhone||"-"}</div>
          <div style="font-size:11px;color:#6B7280;margin-bottom:4px">📍 ${o.deliveryAddress||"-"}</div>
          ${o.locationName?`<div style="font-size:11px;color:#0369A1;margin-bottom:2px">🏠 ${o.locationName}</div>`:""}
          <div style="font-size:11px;margin-bottom:6px">฿${Number(o.total).toLocaleString()} · ${STATUS_LABEL[o.status]||o.status}</div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="font-size:12px;font-weight:700;color:#7C3AED">🧭 นำทาง</a>
        </div>
      `);
      m.on("click", () => setSelected(o));
      markersRef.current.push(m);
    });

    if (routeMode && displayList.length > 1) {
      const latlngs = [];
      if (gpsLatRef.current) latlngs.push([gpsLatRef.current, gpsLngRef.current]);
      displayList.forEach(o => { const lat=Number(o.savedLat||o.deliveryLat),lng=Number(o.savedLng||o.deliveryLng); if(lat&&lng) latlngs.push([lat,lng]); });
      routeLineRef.current.push(L.polyline(latlngs,{color:ORANGE,weight:3,opacity:.8,dashArray:"8 5"}).addTo(map));
    }

    const pts = displayList.filter(o=>Number(o.savedLat||o.deliveryLat));
    if (pts.length>0) {
      const bounds = L.latLngBounds(pts.map(o=>[Number(o.savedLat||o.deliveryLat),Number(o.savedLng||o.deliveryLng)]));
      map.fitBounds(bounds,{padding:[40,40],maxZoom:15});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, routeOrder, routeMode, driverFilter]);

  const unassignedCount = orders.filter(o => !o.driverId && (o.savedLat || o.deliveryLat)).length;

  return (
    <div style={{ display:"flex", height:"calc(100vh - 60px)", overflow:"hidden" }}>

      {/* ── Sidebar ── */}
      <div style={{ width:310, minWidth:310, background:WHITE, borderRight:"1px solid #E5E7EB", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"14px 14px 10px", borderBottom:"1px solid #F3F4F6", flexShrink:0 }}>
          <h2 style={{ fontSize:15, fontWeight:900, color:NAVY, marginBottom:8 }}>🗺️ แผนที่งานจัดส่ง</h2>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1.5px solid #E5E7EB", fontSize:13, boxSizing:"border-box", marginBottom:10 }} />

          {/* Driver tabs */}
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
            <button onClick={()=>{setDriverFilter("all"); clearRoute();}}
              style={{ padding:"5px 10px", borderRadius:20, border:"none", fontSize:11, fontWeight:700, cursor:"pointer",
                background: driverFilter==="all"?NAVY:WHITE, color: driverFilter==="all"?WHITE:GRAY,
                boxShadow: driverFilter==="all"?"none":"inset 0 0 0 1px #E5E7EB" }}>
              ทั้งหมด ({orders.filter(o=>o.savedLat||o.deliveryLat).length})
            </button>
            {orderDrivers.map((d,i) => {
              const cnt = orders.filter(o=>o.driverId===d.id&&(o.savedLat||o.deliveryLat)).length;
              const col = DRIVER_COLORS[i%DRIVER_COLORS.length];
              return (
                <button key={d.id} onClick={()=>{setDriverFilter(d.id); clearRoute();}}
                  style={{ padding:"5px 10px", borderRadius:20, border:"none", fontSize:11, fontWeight:700, cursor:"pointer",
                    background: driverFilter===d.id?col:WHITE, color: driverFilter===d.id?WHITE:col,
                    boxShadow: driverFilter===d.id?"none":`inset 0 0 0 2px ${col}` }}>
                  {d.name} ({cnt})
                </button>
              );
            })}
            {unassignedCount > 0 && (
              <button onClick={()=>{setDriverFilter("unassigned"); clearRoute();}}
                style={{ padding:"5px 10px", borderRadius:20, border:"none", fontSize:11, fontWeight:700, cursor:"pointer",
                  background: driverFilter==="unassigned"?"#9CA3AF":WHITE, color: driverFilter==="unassigned"?WHITE:"#9CA3AF",
                  boxShadow: driverFilter==="unassigned"?"none":"inset 0 0 0 1px #9CA3AF" }}>
                ยังไม่จ่าย ({unassignedCount})
              </button>
            )}
          </div>

          {/* Route button */}
          {withLoc.length > 0 && (
            !routeMode ? (
              <button onClick={calcRoute} style={{ width:"100%", padding:"9px", borderRadius:9, border:"none", background:ORANGE, color:WHITE, fontSize:13, fontWeight:800, cursor:"pointer" }}>
                🛣️ คำนวณเส้นทางที่ดีที่สุด{driverFilter!=="all"&&driverFilter!=="unassigned" ? ` (${orderDrivers.find(d=>d.id===driverFilter)?.name||""})` : ""}
              </button>
            ) : (
              <div>
                <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:9, padding:"8px 12px", marginBottom:6 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#92400E" }}>🛣️ เส้นทางที่แนะนำ · ~{totalKm} กม. · {withLoc.length} จุด</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <a href={googleMapsRouteUrl(orderedList)} target="_blank" rel="noreferrer"
                    style={{ flex:1, padding:"8px 0", borderRadius:8, background:"#10B981", color:WHITE, fontSize:12, fontWeight:700, textAlign:"center", textDecoration:"none" }}>
                    🧭 เปิด Google Maps
                  </a>
                  <button onClick={clearRoute} style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E5E7EB", background:WHITE, fontSize:12, color:GRAY, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            )
          )}

          <div style={{ marginTop:8, fontSize:11, color:GRAY }}>
            {loading ? "กำลังโหลด..." : `${withLoc.length} มีพิกัด · ${withoutLoc.length} ไม่มีพิกัด`}
          </div>
        </div>

        {/* Order list */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {orderedList.map((o, idx) => {
            const driverColor = driverColorMap.get(o.driverId);
            return (
              <div key={o.id} style={{ padding:"10px 12px", borderBottom:"1px solid #F3F4F6", background: selected?.id===o.id?"#EEF2FF":WHITE }}>
                <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                  <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, marginTop:1,
                    background: routeMode ? ORANGE : (driverColor || GRAY),
                    color:WHITE, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800,
                  }}>{idx+1}</div>
                  <div style={{ minWidth:0, flex:1, cursor:"pointer" }} onClick={() => {
                    setSelected(o);
                    const lat=Number(o.savedLat||o.deliveryLat), lng=Number(o.savedLng||o.deliveryLng);
                    if (mapObjRef.current&&lat) mapObjRef.current.setView([lat,lng],16);
                  }}>
                    <div style={{ fontSize:13, fontWeight:700, color:NAVY }}>{o.customerName||"ไม่ระบุ"}</div>
                    <div style={{ fontSize:11, color:GRAY, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.deliveryAddress||"-"}</div>
                    {/* Driver badge */}
                    <div style={{ fontSize:11, marginTop:2, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                      {o.driverName
                        ? <span style={{ background: driverColor||"#E5E7EB", color:WHITE, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>🚴 {o.driverName}</span>
                        : <span style={{ background:"#F3F4F6", color:GRAY, borderRadius:10, padding:"1px 7px", fontSize:10 }}>ยังไม่จ่ายงาน</span>
                      }
                      <span style={{ color:GRAY }}>฿{Number(o.total).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                    <button onClick={()=>setAssignModal(o)}
                      style={{ fontSize:10, padding:"3px 7px", borderRadius:6, border:"1px solid #E5E7EB", background:WHITE, cursor:"pointer", color:NAVY, fontWeight:700, whiteSpace:"nowrap" }}>
                      จ่ายงาน
                    </button>
                    {routeMode && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${Number(o.savedLat||o.deliveryLat)},${Number(o.savedLng||o.deliveryLng)}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize:10, padding:"3px 7px", borderRadius:6, background:"#F3F0FF", color:"#7C3AED", textDecoration:"none", fontWeight:700, textAlign:"center" }}>
                        🧭
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {withoutLoc.length > 0 && (
            <div style={{ padding:"10px 12px", borderTop:"1px solid #F3F4F6", background:"#FFF7ED" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#92400E", marginBottom:6 }}>🔴 ไม่มีพิกัด ({withoutLoc.length})</div>
              {withoutLoc.map(o => (
                <div key={o.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0" }}>
                  <div style={{ fontSize:11, color:"#92400E" }}>· {o.customerName||"ไม่ระบุ"} — {o.deliveryAddress||"-"}</div>
                  <button onClick={()=>setAssignModal(o)}
                    style={{ fontSize:10, padding:"2px 6px", borderRadius:5, border:"1px solid #FED7AA", background:WHITE, cursor:"pointer", color:"#92400E", fontWeight:700, flexShrink:0 }}>
                    จ่ายงาน
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
        <div style={{ background:WHITE, padding:"8px 12px", borderBottom:"1px solid #E5E7EB", position:"relative", zIndex:600, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#F3F4F6", borderRadius:10, padding:"7px 12px" }}>
            <span style={{ fontSize:16 }}>🔍</span>
            <input value={searchQ} onChange={e=>handleSearch(e.target.value)} placeholder="ค้นหาถนน ซอย สถานที่..."
              style={{ flex:1, border:"none", background:"transparent", fontSize:14, outline:"none" }} />
            {searching && <span style={{ fontSize:12, color:GRAY }}>⏳</span>}
            {searchQ && <button onClick={()=>{setSearchQ("");setSearchRes([]);}} style={{ background:"none", border:"none", fontSize:16, cursor:"pointer", color:GRAY }}>✕</button>}
          </div>
          {searchRes.length > 0 && (
            <div style={{ position:"absolute", left:12, right:12, top:"100%", background:WHITE, borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,.15)", maxHeight:240, overflowY:"auto", zIndex:700 }}>
              {searchRes.map((item,i) => (
                <div key={i} onMouseDown={()=>pickSearchResult(item)}
                  style={{ padding:"9px 14px", borderBottom:i<searchRes.length-1?"1px solid #F3F4F6":"none", cursor:"pointer", fontSize:13 }}>
                  📍 {item.name}{item.address?` — ${item.address}`:""}
                </div>
              ))}
            </div>
          )}
        </div>
        <div ref={mapRef} style={{ flex:1 }} />
      </div>

      {/* ── Assign Driver Modal ── */}
      {assignModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setAssignModal(null)}>
          <div style={{ background:WHITE, borderRadius:16, padding:24, width:320, boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:900, fontSize:15, color:NAVY, marginBottom:4 }}>จ่ายงานให้ rider</div>
            <div style={{ fontSize:12, color:GRAY, marginBottom:16 }}>{assignModal.customerName} — {assignModal.deliveryAddress}</div>

            {/* Current driver */}
            {assignModal.driverName && (
              <div style={{ fontSize:12, color:"#7C3AED", marginBottom:12, background:"#F3F0FF", padding:"6px 10px", borderRadius:8 }}>
                🚴 ปัจจุบัน: <strong>{assignModal.driverName}</strong>
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {drivers.map(d => (
                <button key={d.id} onClick={()=>assignDriver(assignModal.id, d.id)}
                  disabled={assigningId===assignModal.id}
                  style={{ padding:"10px 14px", borderRadius:10, border:`2px solid ${d.id===assignModal.driverId?"#7C3AED":"#E5E7EB"}`,
                    background: d.id===assignModal.driverId?"#F3F0FF":WHITE,
                    cursor:"pointer", textAlign:"left", fontSize:13, fontWeight:700, color:NAVY }}>
                  🚴 {d.name}
                  {d.id===assignModal.driverId && <span style={{ color:"#7C3AED", marginLeft:8 }}>✓ ปัจจุบัน</span>}
                </button>
              ))}
              {assignModal.driverId && (
                <button onClick={()=>assignDriver(assignModal.id, null)} disabled={assigningId===assignModal.id}
                  style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #E5E7EB", background:WHITE, cursor:"pointer", fontSize:13, color:"#9CA3AF" }}>
                  ✕ ยกเลิกการจ่ายงาน
                </button>
              )}
            </div>
            <button onClick={()=>setAssignModal(null)}
              style={{ marginTop:12, width:"100%", padding:"9px", borderRadius:9, border:"1px solid #E5E7EB", background:WHITE, cursor:"pointer", fontSize:13, color:GRAY }}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
