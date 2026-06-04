import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

export default function Discounts() {
  const [codes, setCodes] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ type: "fixed", value: "", code: "", maxUses: "", expiresAt: "", description: "", minOrderAmount: "0" });

  const load = () => api.get("/api/v1/discounts").then(r => setCodes(r.data)).catch(() => {});
  useEffect(load, []);

  async function save() {
    await api.post("/api/v1/discounts", { ...form, value: Number(form.value), maxUses: form.maxUses ? Number(form.maxUses) : null, minOrderAmount: Number(form.minOrderAmount) });
    setModal(false); setForm({ type: "fixed", value: "", code: "", maxUses: "", expiresAt: "", description: "", minOrderAmount: "0" }); load();
  }

  async function toggle(id, isActive) {
    await api.put(`/api/v1/discounts/${id}`, { isActive });
    load();
  }

  async function remove(id) {
    if (!confirm("ลบโค้ดนี้?")) return;
    await api.delete(`/api/v1/discounts/${id}`);
    load();
  }

  const F = ({ label, k, type = "text", children, ...rest }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
      {children || (
        <input type={type} value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14 }} {...rest} />
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>🎟 โค้ดส่วนลด</h1>
        <button onClick={() => setModal(true)} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: NAVY, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ สร้างโค้ด</button>
      </div>

      <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {["โค้ด", "ประเภท", "ส่วนลด", "ใช้แล้ว/จำกัด", "หมดอายุ", "สถานะ", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: GRAY, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map(c => {
              const expired = c.expiresAt && new Date() > new Date(c.expiresAt);
              const full    = c.maxUses && c.usedCount >= c.maxUses;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #F3F4F6", opacity: c.isActive && !expired && !full ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: ORANGE, letterSpacing: 1 }}>{c.code}</td>
                  <td style={{ padding: "10px 12px" }}>{c.type === "fixed" ? "💵 จำนวนเงิน" : "📊 เปอร์เซ็นต์"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: NAVY }}>
                    {c.type === "fixed" ? `฿${Number(c.value).toLocaleString()}` : `${c.value}%`}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{c.usedCount} / {c.maxUses ?? "∞"}</td>
                  <td style={{ padding: "10px 12px", color: expired ? "#DC2626" : GRAY }}>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("th-TH") : "ไม่จำกัด"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700,
                      background: c.isActive && !expired && !full ? "#D1FAE5" : "#FEE2E2",
                      color: c.isActive && !expired && !full ? "#065F46" : "#991B1B" }}>
                      {expired ? "หมดอายุ" : full ? "หมด" : c.isActive ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => toggle(c.id, !c.isActive)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontSize: 11, fontWeight: 700 }}>
                        {c.isActive ? "ปิด" : "เปิด"}
                      </button>
                      <button onClick={() => remove(c.id)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #DC2626", background: WHITE, color: "#DC2626", fontSize: 11, fontWeight: 700 }}>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!codes.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ยังไม่มีโค้ด</p>}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>สร้างโค้ดส่วนลด</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>

            <F label="โค้ด (ตัวพิมพ์ใหญ่) *" k="code" placeholder="เช่น SAVE50" />
            <F label="ประเภทส่วนลด">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14 }}>
                <option value="fixed">💵 จำนวนเงิน (บาท)</option>
                <option value="percent">📊 เปอร์เซ็นต์ (%)</option>
              </select>
            </F>
            <F label={`มูลค่าส่วนลด *${form.type === "percent" ? " (%)" : " (บาท)"}`} k="value" type="number" />
            <F label="ยอดสั่งซื้อขั้นต่ำ (บาท)" k="minOrderAmount" type="number" />
            <F label="จำกัดจำนวนครั้ง (ว่าง = ไม่จำกัด)" k="maxUses" type="number" />
            <F label="วันหมดอายุ (ว่าง = ไม่จำกัด)" k="expiresAt" type="date" />
            <F label="คำอธิบาย" k="description" />

            <button onClick={save} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14 }}>
              สร้างโค้ด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
