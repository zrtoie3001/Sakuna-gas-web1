import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({ name: "", email: "", phone: "", password: "" });

  const load = () => api.get("/api/v1/drivers").then(r => setDrivers(r.data)).catch(() => {});
  useEffect(load, []);

  async function save() {
    await api.post("/api/v1/drivers", form);
    setModal(false); setForm({ name: "", email: "", phone: "", password: "" }); load();
  }

  async function toggle(id, isActive) {
    await api.put(`/api/v1/drivers/${id}`, { isActive });
    load();
  }

  const F = (label, k, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
      <input type={type} value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14 }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>🛵 พนักงานส่ง</h1>
        <button onClick={() => setModal(true)} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: NAVY, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ เพิ่มพนักงาน</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {drivers.map(d => (
          <div key={d.id} style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", opacity: d.isActive ? 1 : 0.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, fontSize: 18, fontWeight: 800 }}>
                {d.name?.[0] || "?"}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{d.name}</p>
                <p style={{ fontSize: 12, color: GRAY }}>{d.phone}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: GRAY, marginBottom: 10 }}>📧 {d.email}</p>
            {d.lastLocation && (
              <p style={{ fontSize: 11, color: "#059669", marginBottom: 10 }}>
                📍 อัปเดตตำแหน่ง {new Date(d.lastLocation.updatedAt).toLocaleTimeString("th-TH", { timeStyle: "short" })}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: d.isActive ? "#D1FAE5" : "#FEE2E2", color: d.isActive ? "#065F46" : "#991B1B" }}>
                {d.isActive ? "ทำงาน" : "หยุดพัก"}
              </span>
              <button onClick={() => toggle(d.id, !d.isActive)}
                style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontSize: 11, fontWeight: 700 }}>
                {d.isActive ? "พักงาน" : "กลับทำงาน"}
              </button>
            </div>
          </div>
        ))}
        {!drivers.length && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: GRAY, padding: 40 }}>ยังไม่มีพนักงาน</div>
        )}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>เพิ่มพนักงานส่ง</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>
            {F("ชื่อ-นามสกุล *", "name")}
            {F("Email *", "email", "email")}
            {F("เบอร์โทร *", "phone", "tel")}
            {F("รหัสผ่าน *", "password", "password")}
            <button onClick={save} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14 }}>เพิ่มพนักงาน</button>
          </div>
        </div>
      )}
    </div>
  );
}
