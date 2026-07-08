import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

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
];

export default function Products() {
  const [tab, setTab]           = useState("gas");
  const [search, setSearch]     = useState("");
  const [brands, setBrands]     = useState([]);
  const [products, setProducts] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [stoves, setStoves]     = useState([]);
  const [modal, setModal]       = useState(null); // null | 'gas_new' | 'gas_edit' | 'equip_new' | 'equip_edit' | 'brand_new' | 'brand_edit'
  const [form, setForm]         = useState({});

  const load = () => {
    api.get("/api/v1/products/brands").then(r => setBrands(r.data)).catch(() => {});
    api.get("/api/v1/products").then(r => setProducts(Array.isArray(r.data) ? r.data : r.data.products || [])).catch(() => {});
    api.get("/api/v1/stock/equipment?category=equipment").then(r => setEquipment(r.data)).catch(() => {});
    api.get("/api/v1/stock/equipment?category=stove").then(r => setStoves(r.data)).catch(() => {});
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
          <F label="URL โลโก้" k="logoUrl" />
          <F label="สีหลัก (hex)" k="color" />
          <F label="สีพื้นหลัง (hex)" k="bgColor" />
          <button onClick={saveBrand} style={{ ...btn(NAVY, WHITE), width: "100%", padding: 12 }}>บันทึก</button>
        </Modal>
      )}
    </div>
  );
}
