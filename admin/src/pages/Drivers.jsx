import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";
const EMPTY = { name: "", email: "", phone: "", password: "", role: "driver" };

const ROLE_LABELS = { admin: "Admin เท่านั้น", driver: "พนักงานส่ง", both: "Admin + ส่งของ" };
const ROLE_COLORS = { admin: { bg: "#EEF2FF", color: "#1A2B6B" }, driver: { bg: "#D1FAE5", color: "#065F46" }, both: { bg: "#FEF3C7", color: "#92400E" } };

export default function Drivers() {
  const [drivers, setDrivers]   = useState([]);
  const [modal, setModal]       = useState(false);
  const [editId, setEditId]     = useState(null);
  const [pwModal, setPwModal]   = useState(null); // driver object
  const [newPw, setNewPw]       = useState("");
  const [form, setForm]         = useState(EMPTY);

  const load = () => api.get("/api/v1/drivers").then(r => setDrivers(r.data)).catch(() => {});
  useEffect(load, []);

  function openCreate() { setEditId(null); setForm(EMPTY); setModal(true); }
  function openEdit(d) {
    setEditId(d.id);
    setForm({ name: d.name, email: d.email, phone: d.phone, password: "", role: d.role || "driver" });
    setModal(true);
  }

  async function save() {
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password; // don't send empty pw on edit
      if (editId) await api.put(`/api/v1/drivers/${editId}`, payload);
      else await api.post("/api/v1/drivers", payload);
      setModal(false); setForm(EMPTY); setEditId(null); load();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  async function changePassword() {
    if (!newPw || newPw.length < 6) return alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    try {
      await api.put(`/api/v1/drivers/${pwModal.id}`, { password: newPw });
      alert(`เปลี่ยนรหัสผ่านของ ${pwModal.name} เรียบร้อยแล้ว`);
      setPwModal(null); setNewPw("");
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  async function toggle(id, isActive) {
    await api.put(`/api/v1/drivers/${id}`, { isActive }); load();
  }

  const F = (label, k, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
      <input type={type} value={form[k] ?? ""} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>🛵 พนักงานส่ง</h1>
        <button onClick={openCreate} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: NAVY, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ เพิ่มพนักงาน</button>
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: ROLE_COLORS[d.role]?.bg || "#F3F4F6", color: ROLE_COLORS[d.role]?.color || GRAY }}>
                {ROLE_LABELS[d.role] || d.role}
              </span>
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: d.isActive ? "#D1FAE5" : "#FEE2E2", color: d.isActive ? "#065F46" : "#991B1B" }}>
                {d.isActive ? "ทำงาน" : "หยุดพัก"}
              </span>
              <button onClick={() => openEdit(d)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #6B7280", background: WHITE, color: "#374151", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                แก้ไข
              </button>
              <button onClick={() => { setPwModal(d); setNewPw(""); }}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${ORANGE}`, background: WHITE, color: ORANGE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                🔑 รหัสผ่าน
              </button>
              <button onClick={() => toggle(d.id, !d.isActive)}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {d.isActive ? "พักงาน" : "กลับทำงาน"}
              </button>
            </div>
          </div>
        ))}
        {!drivers.length && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: GRAY, padding: 40 }}>ยังไม่มีพนักงาน</div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{editId ? "แก้ไขพนักงาน" : "เพิ่มพนักงานส่ง"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>
            {F("ชื่อ-นามสกุล *", "name")}
            {F("Email *", "email", "email")}
            {F("เบอร์โทร *", "phone", "tel")}
            {F("รหัสผ่าน" + (editId ? " (ว่าง = ไม่เปลี่ยน)" : " *"), "password", "password", editId ? "ปล่อยว่างถ้าไม่ต้องการเปลี่ยน" : "")}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 6, fontWeight: 700 }}>ตำแหน่ง / สิทธิ์การเข้าถึง</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, role: val }))}
                    style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `2px solid ${form.role === val ? NAVY : "#E5E7EB"}`,
                      background: form.role === val ? NAVY : WHITE,
                      color: form.role === val ? WHITE : "#374151" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={save} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              {editId ? "บันทึก" : "เพิ่มพนักงาน"}
            </button>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {pwModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🔑 เปลี่ยนรหัสผ่าน</h2>
              <button onClick={() => setPwModal(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: GRAY, marginBottom: 14 }}>พนักงาน: <strong style={{ color: NAVY }}>{pwModal.name}</strong></p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="รหัสผ่านใหม่"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <button onClick={changePassword} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: ORANGE, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              บันทึกรหัสผ่านใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
