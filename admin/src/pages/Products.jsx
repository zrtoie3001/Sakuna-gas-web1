import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

// ── Polygon Map Editor ────────────────────────────────────────────────────────
function PolygonEditor({ existingCoords, color, onSave, onClose }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const polyObj = useRef(null);
  const markersRef = useRef([]);
  const [pts, setPts] = useState(() => {
    try { return existingCoords ? JSON.parse(existingCoords) : []; } catch { return []; }
  });

  const redraw = useCallback((map, points) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polyObj.current) polyObj.current.setMap(null);
    if (!points.length) return;
    points.forEach((p, i) => {
      const m = new window.google.maps.Marker({
        position: p, map,
        label: { text: String(i + 1), color: "#fff", fontSize: "11px", fontWeight: "800" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color || "#FF0000", fillOpacity: 1, strokeWeight: 0 },
      });
      markersRef.current.push(m);
    });
    if (points.length >= 3) {
      polyObj.current = new window.google.maps.Polygon({
        paths: points, map,
        strokeColor: color || "#FF0000", strokeOpacity: 0.9, strokeWeight: 2,
        fillColor: color || "#FF0000", fillOpacity: 0.2,
      });
    }
  }, [color]);

  useEffect(() => {
    function initMap() {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 13.890, lng: 100.620 }, zoom: 14,
        mapTypeControl: false, streetViewControl: false,
      });
      mapObj.current = map;
      map.addListener("click", e => {
        const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setPts(prev => { const next = [...prev, pt]; redraw(map, next); return next; });
      });
      const initial = (() => { try { return existingCoords ? JSON.parse(existingCoords) : []; } catch { return []; } })();
      if (initial.length) { redraw(map, initial); }
    }
    if (window.google?.maps) { initMap(); return; }
    const cbName = "__gmPolygonInit" + Date.now();
    window[cbName] = () => { initMap(); delete window[cbName]; };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&callback=${cbName}`;
    document.head.appendChild(s);
  }, []);

  function undo() {
    setPts(prev => { const next = prev.slice(0, -1); redraw(mapObj.current, next); return next; });
  }
  function clear() { setPts([]); redraw(mapObj.current, []); }
  function save() { onSave(JSON.stringify(pts)); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", background: NAVY, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>🗺 วาดขอบเขตโซน — คลิกบนแผนที่เพื่อเพิ่มจุด</span>
        <span style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>{pts.length} จุด{pts.length >= 3 ? " ✓" : " (ต้องการ ≥ 3)"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={undo} disabled={!pts.length} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#374151", color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>↩ ยกเลิกจุดล่าสุด</button>
          <button onClick={clear} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#7F1D1D", color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🗑 ล้างทั้งหมด</button>
          <button onClick={save} disabled={pts.length < 3} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: pts.length >= 3 ? "#059669" : "#374151", color: WHITE, fontWeight: 800, fontSize: 13, cursor: pts.length >= 3 ? "pointer" : "default" }}>✅ บันทึก Polygon</button>
          <button onClick={onClose} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#374151", color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✕ ยกเลิก</button>
        </div>
      </div>
      <div ref={mapRef} style={{ flex: 1 }} />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const btn = (bg, color) => ({ padding: "8px 14px", borderRadius: 8, background: bg, color, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" });

const TABS = [
  { key: "gas",       label: "⛽ ถังแก๊ส" },
  { key: "equipment", label: "🔧 อุปกรณ์/อะไหล่" },
  { key: "stove",     label: "🍳 เตา" },
  { key: "brands",    label: "🏷 ยี่ห้อ" },
  { key: "zones",     label: "🗺 โซนราคา" },
];

export default function Products() {
  const [tab, setTab]           = useState("gas");
  const [search, setSearch]     = useState("");
  const [brands, setBrands]     = useState([]);
  const [products, setProducts] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stoves, setStoves]     = useState([]);
  const [zones, setZones]       = useState([]);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState({});
  const [zoneForm, setZoneForm] = useState({ name: "", label: "", color: "#DC2626", centerLat: "", centerLng: "", radiusKm: "", maxKm: "", minLat: "", minLng: "", polygonCoords: "" });
  const [zonePriceForm, setZonePriceForm] = useState({}); // { productId: price }
  const [editZone, setEditZone] = useState(null);
  const [showPolyEditor, setShowPolyEditor] = useState(false);

  const load = () => {
    api.get("/api/v1/products/brands").then(r => setBrands(r.data)).catch(() => {});
    api.get("/api/v1/products").then(r => setProducts(Array.isArray(r.data) ? r.data : r.data.products || [])).catch(() => {});
    api.get("/api/v1/stock/equipment?category=equipment").then(r => setEquipment(r.data)).catch(() => {});
    api.get("/api/v1/stock/equipment?category=stove").then(r => setStoves(r.data)).catch(() => {});
    api.get("/api/v1/products/zones").then(r => setZones(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  };
  useEffect(load, []);

  async function saveGasProduct() {
    if (form.id) await api.put(`/api/v1/products/${form.id}`, form);
    else await api.post("/api/v1/products", form);
    setModal(null); setForm({}); load();
  }

  async function deleteGasProduct(id) {
    if (!confirm("ลบสินค้านี้?")) return;
    await api.delete(`/api/v1/products/${id}`);
    load();
  }

  async function saveEquipment(category) {
    const data = { ...form, category };
    if (form.id) await api.put(`/api/v1/stock/equipment/${form.id}`, data);
    else await api.post("/api/v1/stock/equipment", data);
    setModal(null); setForm({}); load();
  }

  async function deleteEquipmentItem(id) {
    if (!confirm("ลบรายการนี้?")) return;
    await api.delete(`/api/v1/stock/equipment/${id}`);
    load();
  }

  async function adjustEquipmentQty(id, delta) {
    const item = [...equipment, ...stoves].find(e => e.id === id);
    if (!item) return;
    const newQty = Math.max(0, Number(item.qty) + delta);
    await api.put(`/api/v1/stock/equipment/${id}`, { qty: newQty });
    load();
  }

  async function saveBrand() {
    if (form.id) await api.put(`/api/v1/products/brands/${form.id}`, form);
    else await api.post("/api/v1/products/brands", form);
    setModal(null); setForm({}); load();
  }

  async function deleteBrand(id) {
    if (!confirm("ลบยี่ห้อนี้?")) return;
    await api.delete(`/api/v1/products/brands/${id}`);
    load();
  }

  async function saveZone() {
    const zonePrices = Object.entries(zonePriceForm)
      .filter(([, price]) => price !== "" && price !== undefined)
      .map(([productId, price]) => ({ productId, price: Number(price) }));
    const payload = {
      name: zoneForm.name, label: zoneForm.label, color: zoneForm.color,
      centerLat: zoneForm.centerLat || null, centerLng: zoneForm.centerLng || null,
      radiusKm: zoneForm.radiusKm || null, maxKm: zoneForm.maxKm || null,
      minLat: zoneForm.minLat || null, minLng: zoneForm.minLng || null,
      polygonCoords: zoneForm.polygonCoords || null,
      isActive: true, zonePrices,
    };
    if (editZone) await api.put(`/api/v1/products/zones/${editZone.id}`, payload);
    else await api.post("/api/v1/products/zones", payload);
    setModal(null); setEditZone(null); setZoneForm({ name: "", label: "", color: "#DC2626", centerLat: "", centerLng: "", radiusKm: "", maxKm: "", minLat: "", minLng: "" }); setZonePriceForm({});
    load();
  }

  async function deleteZone(id) {
    if (!confirm("ลบโซนนี้?")) return;
    await api.delete(`/api/v1/products/zones/${id}`);
    load();
  }

  function openEditZone(zone) {
    setEditZone(zone);
    setZoneForm({ name: zone.name, label: zone.label || "", color: zone.color || "#DC2626", centerLat: zone.centerLat || "", centerLng: zone.centerLng || "", radiusKm: zone.radiusKm || "", maxKm: zone.maxKm || "", minLat: zone.minLat || "", minLng: zone.minLng || "" });
    const priceMap = {};
    (zone.zonePrices || []).forEach(zp => { priceMap[zp.productId] = zp.price; });
    setZonePriceForm(priceMap);
    setZoneForm(f => ({ ...f, polygonCoords: zone.polygonCoords || "" }));
    setModal("zone_edit");
  }

  const F = ({ label, k, type = "text", ...rest }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
      <input type={type} value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} {...rest} />
    </div>
  );

  const filtered = (list, keys) => list.filter(item =>
    !search || keys.some(k => String(item[k] || "").toLowerCase().includes(search.toLowerCase()))
  );

  const EquipCard = ({ item, category }) => (
    <div style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 2 }}>{item.name}</p>
          {item.description && <p style={{ fontSize: 12, color: GRAY }}>{item.description}</p>}
          <p style={{ fontSize: 13, color: ORANGE, fontWeight: 700, marginTop: 4 }}>฿{Number(item.price).toLocaleString()}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <button onClick={() => adjustEquipmentQty(item.id, -1)} style={{ width: 30, height: 30, borderRadius: 8, border: `2px solid #E5E7EB`, background: WHITE, fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
        <span style={{ fontSize: 15, fontWeight: 800, color: NAVY, minWidth: 40, textAlign: "center" }}>{item.qty}</span>
        <button onClick={() => adjustEquipmentQty(item.id, 1)} style={{ width: 30, height: 30, borderRadius: 8, border: `2px solid ${ORANGE}`, background: "#FFF7ED", fontSize: 16, cursor: "pointer", fontWeight: 700, color: ORANGE }}>+</button>
        <span style={{ fontSize: 11, color: GRAY }}>ชิ้น</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={() => { setModal(`equip_edit_${category}`); setForm(item); }} style={{ ...btn(WHITE, NAVY), flex: 1, border: `2px solid ${NAVY}` }}>แก้ไข</button>
        <button onClick={() => deleteEquipmentItem(item.id)} style={{ ...btn("#FEE2E2", "#991B1B"), border: "none" }}>ลบ</button>
      </div>
    </div>
  );

  const currentCategory = modal?.includes("equip_edit_") ? modal.replace("equip_new_", "").replace("equip_edit_", "") : modal?.replace("equip_new_", "");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>🛢 สินค้า</h1>
        <input placeholder="🔍 ค้นหาสินค้า..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 13, width: 200 }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tab === "gas" && <button onClick={() => { setModal("gas_new"); setForm({}); }} style={btn(ORANGE, WHITE)}>+ เพิ่มสินค้าถัง</button>}
          {tab === "equipment" && <button onClick={() => { setModal("equip_new_equipment"); setForm({}); }} style={btn(ORANGE, WHITE)}>+ เพิ่มอุปกรณ์</button>}
          {tab === "stove" && <button onClick={() => { setModal("equip_new_stove"); setForm({}); }} style={btn(ORANGE, WHITE)}>+ เพิ่มเตา</button>}
          {tab === "brands" && <button onClick={() => { setModal("brand_new"); setForm({}); }} style={btn(NAVY, WHITE)}>+ เพิ่มยี่ห้อ</button>}
          {tab === "zones" && <button onClick={() => { setModal("zone_new"); setEditZone(null); setZoneForm({ name: "", label: "", color: "#DC2626", centerLat: "", centerLng: "", radiusKm: "", maxKm: "", minLat: "", minLng: "", polygonCoords: "" }); setZonePriceForm({}); }} style={btn(ORANGE, WHITE)}>+ เพิ่มโซน</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: tab === t.key ? NAVY : WHITE, color: tab === t.key ? WHITE : GRAY,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ⛽ ถังแก๊ส */}
      {tab === "gas" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered(products, ["name", "description"]).map(p => (
            <div key={p.id} style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", opacity: p.isActive ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{p.name} {p.isHot && "🔥"}</p>
                  {p.description && <p style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{p.description}</p>}
                  {p.kg && <p style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>⚖️ {p.kg} กก.</p>}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>฿{Number(p.homePrice).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: GRAY, marginLeft: 4 }}>ราคาบ้าน</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => { setModal("gas_edit"); setForm(p); }} style={{ ...btn(WHITE, NAVY), flex: 1, border: `2px solid ${NAVY}` }}>แก้ไข</button>
                <button onClick={() => deleteGasProduct(p.id)} style={{ ...btn("#FEE2E2", "#991B1B"), border: "none" }}>ลบ</button>
              </div>
            </div>
          ))}
          {!products.length && <p style={{ color: GRAY, gridColumn: "1/-1" }}>ยังไม่มีสินค้า</p>}
        </div>
      )}

      {/* 🔧 อุปกรณ์/อะไหล่ */}
      {tab === "equipment" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered(equipment, ["name", "description"]).map(item => <EquipCard key={item.id} item={item} category="equipment" />)}
          {!equipment.length && <p style={{ color: GRAY, gridColumn: "1/-1" }}>ยังไม่มีอุปกรณ์ — เพิ่มจากหน้าสต็อก หรือกด "+ เพิ่มอุปกรณ์"</p>}
        </div>
      )}

      {/* 🍳 เตา */}
      {tab === "stove" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {filtered(stoves, ["name", "description"]).map(item => <EquipCard key={item.id} item={item} category="stove" />)}
          {!stoves.length && <p style={{ color: GRAY, gridColumn: "1/-1" }}>ยังไม่มีเตา — เพิ่มจากหน้าสต็อก หรือกด "+ เพิ่มเตา"</p>}
        </div>
      )}

      {/* 🏷 ยี่ห้อ */}
      {tab === "brands" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {filtered(brands, ["name"]).map(b => (
            <div key={b.id} style={{ background: b.bgColor || WHITE, borderRadius: 14, padding: 16, border: `2px solid ${b.color || "#E5E7EB"}`, opacity: b.isActive ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {b.logoUrl && <img src={b.logoUrl} alt={b.name} style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6 }} />}
                <p style={{ fontSize: 15, fontWeight: 800, color: b.color || NAVY, flex: 1 }}>{b.name}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setModal("brand_edit"); setForm(b); }} style={{ ...btn(WHITE, NAVY), flex: 1, border: `2px solid ${b.color || NAVY}` }}>แก้ไข</button>
                <button onClick={() => deleteBrand(b.id)} style={{ ...btn("#FEE2E2", "#991B1B"), border: "none" }}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🗺 โซนราคา */}
      {tab === "zones" && (
        <div>
          <p style={{ fontSize: 12, color: GRAY, marginBottom: 12 }}>
            กำหนดโซนพื้นที่พิเศษที่มีราคาสินค้าต่างจากปกติ เช่น โซนวัดหนองผักชี<br/>
            <strong>โซนแบบพื้นที่</strong>: ใส่ Lat/Lng จุดกลาง + รัศมี (km) — ตรวจจากพิกัด GPS ลูกค้า<br/>
            <strong>โซนแบบระยะทาง</strong>: ใส่ maxKm เท่านั้น — ตรวจจากระยะทางจากร้าน
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {zones.map(z => (
              <div key={z.id} style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", borderLeft: `4px solid ${z.color || NAVY}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{z.label || z.name}</span>
                    <span style={{ fontSize: 11, color: GRAY, marginLeft: 6 }}>({z.name})</span>
                  </div>
                  <span style={{ fontSize: 11, background: (z.color || "#6B7280") + "20", color: z.color || GRAY, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                    {z.polygonCoords ? `🗺 Polygon` : z.centerLat ? `📍 ${Number(z.radiusKm).toFixed(1)} km` : `📏 ≤${Number(z.maxKm).toFixed(1)} km`}
                  </span>
                </div>
                {(z.zonePrices || []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {z.zonePrices.map(zp => {
                      const prod = products.find(p => p.id === zp.productId);
                      return prod ? (
                        <div key={zp.productId} style={{ fontSize: 12, color: GRAY, display: "flex", justifyContent: "space-between" }}>
                          <span>{prod.name}</span>
                          <span style={{ fontWeight: 700, color: ORANGE }}>฿{Number(zp.price).toLocaleString()}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                {!(z.zonePrices || []).length && <p style={{ fontSize: 11, color: GRAY, marginBottom: 8 }}>ยังไม่มีราคาพิเศษ</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEditZone(z)} style={{ ...btn(WHITE, NAVY), flex: 1, border: `2px solid ${NAVY}` }}>แก้ไข</button>
                  <button onClick={() => deleteZone(z.id)} style={{ ...btn("#FEE2E2", "#991B1B"), border: "none" }}>ลบ</button>
                </div>
              </div>
            ))}
            {!zones.length && <p style={{ color: GRAY }}>ยังไม่มีโซน — กด "+ เพิ่มโซน"</p>}
          </div>
        </div>
      )}

      {/* Modal: Zone */}
      {(modal === "zone_new" || modal === "zone_edit") && (
        <Modal title={modal === "zone_new" ? "เพิ่มโซนราคา" : "แก้ไขโซน"} onClose={() => { setModal(null); setEditZone(null); }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ชื่อโซน (ภาษาอังกฤษ เช่น C) *</label>
            <input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="C" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ชื่อแสดง เช่น โซนวัดหนองผักชี</label>
            <input value={zoneForm.label} onChange={e => setZoneForm(f => ({ ...f, label: e.target.value }))} style={inp} placeholder="โซนวัดหนองผักชี" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>สี (hex)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={zoneForm.color} onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))} style={{ width: 40, height: 36, border: "none", cursor: "pointer" }} />
              <input value={zoneForm.color} onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))} style={{ ...inp, flex: 1 }} />
            </div>
          </div>
          {/* Polygon zone */}
          <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 12, border: "2px solid #86EFAC" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8 }}>🗺 โซนแบบ Polygon (แนะนำ — วาดตามถนนได้เลย)</p>
            {zoneForm.polygonCoords ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#166534", flex: 1 }}>
                  ✅ วาดแล้ว {(() => { try { return JSON.parse(zoneForm.polygonCoords).length; } catch { return 0; } })()} จุด
                </span>
                <button onClick={() => setShowPolyEditor(true)} style={{ ...btn("#D1FAE5", "#065F46"), fontSize: 11 }}>แก้ไข</button>
                <button onClick={() => setZoneForm(f => ({ ...f, polygonCoords: "" }))} style={{ ...btn("#FEE2E2", "#991B1B"), fontSize: 11 }}>ลบ</button>
              </div>
            ) : (
              <button onClick={() => setShowPolyEditor(true)} style={{ ...btn("#059669", WHITE), width: "100%", padding: 10 }}>
                ✏️ วาด Polygon บนแผนที่
              </button>
            )}
          </div>

          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>📍 โซนแบบวงกลม (ถ้าไม่ใช้ Polygon)</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>Latitude จุดกลาง</label>
                <input type="number" step="any" value={zoneForm.centerLat} onChange={e => setZoneForm(f => ({ ...f, centerLat: e.target.value }))} style={inp} placeholder="13.900" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>Longitude จุดกลาง</label>
                <input type="number" step="any" value={zoneForm.centerLng} onChange={e => setZoneForm(f => ({ ...f, centerLng: e.target.value }))} style={inp} placeholder="100.605" />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>รัศมี (km)</label>
              <input type="number" step="0.1" value={zoneForm.radiusKm} onChange={e => setZoneForm(f => ({ ...f, radiusKm: e.target.value }))} style={inp} placeholder="2.0" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>minLat — เหนือเส้น lat นี้เท่านั้น</label>
                <input type="number" step="any" value={zoneForm.minLat ?? ""} onChange={e => setZoneForm(f => ({ ...f, minLat: e.target.value }))} style={inp} placeholder="13.883" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>minLng — ตะวันออกของ lng นี้เท่านั้น</label>
                <input type="number" step="any" value={zoneForm.minLng ?? ""} onChange={e => setZoneForm(f => ({ ...f, minLng: e.target.value }))} style={inp} placeholder="100.600" />
              </div>
            </div>
            <p style={{ fontSize: 10, color: GRAY, marginTop: 4 }}>ปล่อยว่าง = ไม่จำกัด · ใช้คู่กันเพื่อตัดพื้นที่ฝั่งที่ไม่ต้องการออก</p>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>📏 โซนแบบระยะทาง (ใส่ระยะสูงสุดจากร้าน)</p>
            <div>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>ระยะสูงสุด maxKm</label>
              <input type="number" step="0.1" value={zoneForm.maxKm} onChange={e => setZoneForm(f => ({ ...f, maxKm: e.target.value }))} style={inp} placeholder="3.0" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>💰 ราคาสินค้าในโซนนี้</p>
            {products.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: NAVY, flex: 1 }}>{p.name} <span style={{ color: GRAY }}>(ปกติ ฿{Number(p.homePrice).toLocaleString()})</span></span>
                <input type="number" value={zonePriceForm[p.id] ?? ""} onChange={e => setZonePriceForm(f => ({ ...f, [p.id]: e.target.value }))}
                  style={{ ...inp, width: 90 }} placeholder="ราคา" />
              </div>
            ))}
            <p style={{ fontSize: 11, color: GRAY }}>ปล่อยว่างไว้ = ใช้ราคาปกติ</p>
          </div>
          <button onClick={saveZone} style={{ ...btn(NAVY, WHITE), width: "100%", padding: 12 }}>บันทึก</button>
        </Modal>
      )}

      {/* Polygon Editor overlay */}
      {showPolyEditor && (
        <PolygonEditor
          existingCoords={zoneForm.polygonCoords}
          color={zoneForm.color}
          onSave={coords => { setZoneForm(f => ({ ...f, polygonCoords: coords })); setShowPolyEditor(false); }}
          onClose={() => setShowPolyEditor(false)}
        />
      )}

      {/* Modal: Gas product */}
      {(modal === "gas_new" || modal === "gas_edit") && (
        <Modal title={modal === "gas_new" ? "เพิ่มสินค้าถัง" : "แก้ไขสินค้า"} onClose={() => { setModal(null); setForm({}); }}>
          <F label="ชื่อสินค้า *" k="name" />
          <F label="ขนาด (กก.)" k="kg" type="number" />
          <F label="ราคาบ้านพักอาศัย *" k="homePrice" type="number" />
          <F label="คำอธิบาย" k="description" />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.isHot || false} onChange={e => setForm(f => ({ ...f, isHot: e.target.checked }))} />
              🔥 ขายดี
            </label>
          </div>
          <button onClick={saveGasProduct} style={{ ...btn(NAVY, WHITE), width: "100%", padding: 12 }}>บันทึก</button>
        </Modal>
      )}

      {/* Modal: Equipment / Stove */}
      {(modal?.startsWith("equip_new_") || modal?.startsWith("equip_edit_")) && (
        <Modal
          title={modal.includes("stove") ? (modal.startsWith("equip_new") ? "เพิ่มเตา" : "แก้ไขเตา") : (modal.startsWith("equip_new") ? "เพิ่มอุปกรณ์/อะไหล่" : "แก้ไขอุปกรณ์")}
          onClose={() => { setModal(null); setForm({}); }}
        >
          <F label="ชื่อสินค้า *" k="name" />
          <F label="ราคา" k="price" type="number" />
          <F label="จำนวนในสต็อก" k="qty" type="number" />
          <F label="คำอธิบาย" k="description" />
          <button onClick={() => saveEquipment(modal.includes("stove") ? "stove" : "equipment")} style={{ ...btn(NAVY, WHITE), width: "100%", padding: 12 }}>บันทึก</button>
        </Modal>
      )}

      {/* Modal: Brand */}
      {(modal === "brand_new" || modal === "brand_edit") && (
        <Modal title={modal === "brand_new" ? "เพิ่มยี่ห้อ" : "แก้ไขยี่ห้อ"} onClose={() => { setModal(null); setForm({}); }}>
          <F label="ชื่อยี่ห้อ *" k="name" />

          {/* Logo upload */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 6, fontWeight: 700 }}>รูปโลโก้</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {form.logoUrl && (
                <img src={form.logoUrl} alt="logo" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "2px solid #E5E7EB" }} />
              )}
              <label style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 10px", borderRadius: 8, border: "2px dashed #CBD5E1", cursor: "pointer", fontSize: 13, color: GRAY, gap: 4 }}>
                📷 {form.logoUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => setForm(f => ({ ...f, logoUrl: ev.target.result }));
                  reader.readAsDataURL(file);
                }} />
              </label>
              {form.logoUrl && (
                <button onClick={() => setForm(f => ({ ...f, logoUrl: "" }))} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#FEE2E2", color: "#991B1B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>ลบรูป</button>
              )}
            </div>
          </div>

          <F label="สีหลัก (hex)" k="color" />
          <F label="สีพื้นหลัง (hex)" k="bgColor" />
          <button onClick={saveBrand} style={{ ...btn(NAVY, WHITE), width: "100%", padding: 12 }}>บันทึก</button>
        </Modal>
      )}
    </div>
  );
}
