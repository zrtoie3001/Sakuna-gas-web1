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

export default function Products() {
  const [brands, setBrands]     = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab]           = useState("products");
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState({});

  const load = () => {
    api.get("/api/v1/products/brands").then(r => setBrands(r.data)).catch(() => {});
    api.get("/api/v1/products").then(r => setProducts(r.data)).catch(() => {});
  };
  useEffect(load, []);

  async function save() {
    if (modal === "brand_new")      await api.post("/api/v1/products/brands", form);
    else if (modal?.startsWith("brand_edit_")) await api.put(`/api/v1/products/brands/${modal.split("_")[2]}`, form);
    else if (modal === "product_new")  await api.post("/api/v1/products", form);
    else if (modal?.startsWith("product_edit_")) await api.put(`/api/v1/products/${modal.split("_")[2]}`, form);
    setModal(null); setForm({}); load();
  }

  async function toggleActive(type, id, val) {
    if (type === "brand")   await api.put(`/api/v1/products/brands/${id}`, { isActive: val });
    else                    await api.put(`/api/v1/products/${id}`, { isActive: val });
    load();
  }

  const Field = ({ label, k, type = "text", ...rest }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
      <input type={type} value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14 }} {...rest} />
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>🛢 สินค้า</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => { setTab("brands"); setModal("brand_new"); setForm({}); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: NAVY, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ เพิ่มยี่ห้อ</button>
          <button onClick={() => { setTab("products"); setModal("product_new"); setForm({}); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: ORANGE, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ เพิ่มสินค้า</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["products", "brands"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: tab === t ? NAVY : WHITE, color: tab === t ? WHITE : GRAY,
          }}>{t === "products" ? "🛢 สินค้า" : "🏷 ยี่ห้อ"}</button>
        ))}
      </div>

      {/* Products list */}
      {tab === "products" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {products.map(p => (
            <div key={p.id} style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", opacity: p.isActive ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{p.name} {p.isHot && "🔥"}</p>
                  <p style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{p.description}</p>
                </div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={p.isActive} onChange={e => toggleActive("product", p.id, e.target.checked)} style={{ width: 16, height: 16 }} />
                </label>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>฿{Number(p.homePrice).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: GRAY }}>ราคาบ้าน</span>
              </div>
              <button onClick={() => { setModal(`product_edit_${p.id}`); setForm(p); }}
                style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 8, border: `2px solid ${NAVY}`, background: WHITE, color: NAVY, fontSize: 12, fontWeight: 700 }}>
                แก้ไข
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Brands list */}
      {tab === "brands" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {brands.map(b => (
            <div key={b.id} style={{ background: b.bgColor || WHITE, borderRadius: 14, padding: 16, border: `2px solid ${b.color || "#E5E7EB"}`, opacity: b.isActive ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {b.logoUrl && <img src={b.logoUrl} alt={b.name} style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6 }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: b.color || NAVY }}>{b.name}</p>
                </div>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={b.isActive} onChange={e => toggleActive("brand", b.id, e.target.checked)} style={{ width: 16, height: 16 }} />
                </label>
              </div>
              <button onClick={() => { setModal(`brand_edit_${b.id}`); setForm(b); }}
                style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 8, border: `2px solid ${b.color || NAVY}`, background: WHITE, color: b.color || NAVY, fontSize: 12, fontWeight: 700 }}>
                แก้ไข
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal.includes("brand") ? (modal.includes("new") ? "เพิ่มยี่ห้อ" : "แก้ไขยี่ห้อ") : (modal.includes("new") ? "เพิ่มสินค้า" : "แก้ไขสินค้า")} onClose={() => { setModal(null); setForm({}); }}>
          {modal.includes("brand") ? (
            <>
              <Field label="ชื่อยี่ห้อ *" k="name" />
              <Field label="URL โลโก้" k="logoUrl" />
              <Field label="สีหลัก (hex)" k="color" />
              <Field label="สีพื้นหลัง (hex)" k="bgColor" />
            </>
          ) : (
            <>
              <Field label="ชื่อสินค้า *" k="name" />
              <Field label="ขนาด (กก.)" k="kg" type="number" />
              <Field label="ราคาบ้านพักอาศัย *" k="homePrice" type="number" />
              <Field label="คำอธิบาย" k="description" />
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={form.isHot || false} onChange={e => setForm(f => ({ ...f, isHot: e.target.checked }))} />
                  🔥 ขายดี
                </label>
              </div>
            </>
          )}
          <button onClick={save} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14 }}>บันทึก</button>
        </Modal>
      )}
    </div>
  );
}
