import { useState, useEffect, useRef } from "react";
import api from "../utils/api.js";

const NAVY = "#1E3A5F";
const WHITE = "#FFFFFF";
const GRAY = "#6B7280";
const GREEN = "#059669";
const RED = "#DC2626";
const ORANGE = "#D97706";

const TYPE_LABEL = { fuel: "⛽ เติมน้ำมัน", repair: "🔧 ซ่อมรถ/อื่นๆ", other: "📦 ทั่วไป", parcel: "📮 พัสดุ" };
const TYPE_COLOR = { fuel: "#FEF3C7", repair: "#FEE2E2", other: "#EFF6FF", parcel: "#F3E8FF" };
const TYPE_TEXT  = { fuel: "#92400E", repair: "#991B1B", other: "#1E40AF", parcel: "#6B21A8" };

const btn = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 10, padding: "8px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
});
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "fuel", amount: "", description: "", createdByName: "" });
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState(today);
  const [filterTo, setFilterTo] = useState(today);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  async function load() {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to",   filterTo);
    const r = await api.get(`/api/v1/expenses?${params}`);
    setExpenses(r.data.expenses || []);
    setTotal(r.data.total || 0);
  }

  useEffect(() => { load(); }, [filterType, filterFrom, filterTo]);

  function pickFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!form.amount) return alert("กรุณาระบุจำนวนเงิน");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("type", form.type);
      fd.append("amount", form.amount);
      fd.append("description", form.description);
      fd.append("createdByName", form.createdByName);
      if (slipFile) fd.append("slip", slipFile);
      await api.post("/api/v1/expenses", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm({ type: "fuel", amount: "", description: "", createdByName: "" });
      setSlipFile(null); setSlipPreview(null);
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm("ลบรายการนี้?")) return;
    await api.delete(`/api/v1/expenses/${id}`);
    load();
  }

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>รายการเบิกเงิน</div>
          <div style={{ fontSize: 12, color: GRAY }}>รวม {total} รายการ</div>
        </div>
        <button onClick={() => setShowForm(true)} style={btn(NAVY, WHITE)}>+ เบิกเงิน</button>
      </div>

      {/* Summary card */}
      {expenses.length > 0 && (
        <div style={{ background: "#FFF7ED", border: `1.5px solid ${ORANGE}`, borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: "#92400E", fontSize: 14 }}>รวมค่าใช้จ่าย (ที่กรอง)</span>
          <span style={{ fontWeight: 800, color: RED, fontSize: 18 }}>฿{totalAmount.toLocaleString()}</span>
        </div>
      )}

      {/* Filter */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, width: "auto", flex: 1 }}>
          <option value="">ทุกประเภท</option>
          <option value="fuel">⛽ เติมน้ำมัน</option>
          <option value="repair">🔧 ซ่อมรถ/อื่นๆ</option>
          <option value="other">📦 ทั่วไป</option>
          <option value="parcel">📮 พัสดุ</option>
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...inp, width: "auto", flex: 1 }} />
        <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   style={{ ...inp, width: "auto", flex: 1 }} />
        <button onClick={() => { setFilterType(""); setFilterFrom(today); setFilterTo(today); }} style={btn("#EFF6FF", "#1D4ED8")}>วันนี้</button>
        {(filterType || filterFrom !== today || filterTo !== today) && (
          <button onClick={() => { setFilterType(""); setFilterFrom(""); setFilterTo(""); }} style={btn("#F3F4F6", GRAY)}>ทั้งหมด</button>
        )}
      </div>

      {/* List */}
      {expenses.length === 0 ? (
        <div style={{ textAlign: "center", color: GRAY, padding: 40, fontSize: 14 }}>ยังไม่มีรายการเบิกเงิน</div>
      ) : (
        expenses.map(e => (
          <div key={e.id} style={{ background: WHITE, borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* Slip thumbnail */}
            <div style={{ flexShrink: 0 }}>
              {e.slipUrl ? (
                <img
                  src={`${API_URL}${e.slipUrl}`}
                  alt="slip"
                  onClick={() => setLightbox(`${API_URL}${e.slipUrl}`)}
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, cursor: "pointer", border: "1.5px solid #E5E7EB" }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 10, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {e.type === "fuel" ? "⛽" : e.type === "repair" ? "🔧" : "📦"}
                </div>
              )}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ background: TYPE_COLOR[e.type] || "#F3F4F6", color: TYPE_TEXT[e.type] || GRAY, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {TYPE_LABEL[e.type] || e.type}
                </span>
                <span style={{ fontWeight: 800, color: RED, fontSize: 16, whiteSpace: "nowrap" }}>฿{Number(e.amount).toLocaleString()}</span>
              </div>
              {e.createdByName && <div style={{ marginTop: 6, fontSize: 12, color: NAVY, fontWeight: 700 }}>👤 {e.createdByName}</div>}
              {e.description && <div style={{ marginTop: 4, fontSize: 13, color: "#374151" }}>{e.description}</div>}
              <div style={{ marginTop: 4, fontSize: 11, color: GRAY }}>
                {new Date(e.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <button onClick={() => del(e.id)} style={{ ...btn("#FEE2E2", RED), padding: "6px 10px", flexShrink: 0 }}>ลบ</button>
          </div>
        ))
      )}

      {/* Add form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 18 }}>เบิกเงิน</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ประเภท</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                <option value="fuel">⛽ เติมน้ำมัน</option>
                <option value="repair">🔧 ซ่อมรถ / ค่าจิปาถะ</option>
                <option value="other">📦 อื่นๆ</option>
                <option value="parcel">📮 พัสดุ</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ใครเบิก (ถ้ามี)</label>
              <input value={form.createdByName} onChange={e => setForm(f => ({ ...f, createdByName: e.target.value }))} style={inp} placeholder="เช่น สมชาย / ป้าแดง" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>จำนวนเงิน (บาท) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} placeholder="500" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>รายละเอียด</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, height: 80, resize: "vertical" }} placeholder="เช่น เติมน้ำมันรถส่ง รถทะเบียน..." />
            </div>

            {/* Slip upload — optional */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>สลิป / รูปถ่าย <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(ไม่บังคับ)</span></label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickFile} style={{ display: "none" }} />
              {slipPreview ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={slipPreview} alt="preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1.5px solid #E5E7EB" }} />
                  <button onClick={() => { setSlipFile(null); setSlipPreview(null); }} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: RED, color: WHITE, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()} style={{ ...btn("#F3F4F6", GRAY), padding: "8px 14px", fontSize: 12 }}>
                  📷 แนบสลิป (ถ้ามี)
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowForm(false); setSlipFile(null); setSlipPreview(null); }} style={{ ...btn("#F3F4F6", GRAY), flex: 1, padding: 12 }}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={{ ...btn(NAVY, WHITE), flex: 2, padding: 12, opacity: saving ? 0.7 : 1 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
          <img src={lightbox} alt="slip full" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
