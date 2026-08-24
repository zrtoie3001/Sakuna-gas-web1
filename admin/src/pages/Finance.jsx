import { useState, useEffect, useRef } from "react";
import api from "../utils/api.js";

const NAVY  = "#1E3A5F";
const WHITE = "#FFFFFF";
const GRAY  = "#6B7280";
const RED   = "#DC2626";
const GREEN = "#059669";

const TYPE_LABEL = {
  salary:  "💰 เงินเดือน",
  advance: "💳 เบิกล่วงหน้า",
  bonus:   "🎁 โบนัส",
  other:   "📦 อื่นๆ",
};
const TYPE_COLOR = { salary: "#D1FAE5", advance: "#DBEAFE", bonus: "#FEF3C7", other: "#F3F4F6" };
const TYPE_TEXT  = { salary: "#065F46", advance: "#1E40AF", bonus: "#92400E", other: GRAY };

const btn = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 10, padding: "8px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
});
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export default function Finance() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal]       = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ staffName: "", amount: "", type: "salary", note: "" });
  const [slipFile, setSlipFile]   = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo]     = useState("");
  const [lightbox, setLightbox]     = useState(null);
  const fileRef = useRef();

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  async function load() {
    const params = new URLSearchParams();
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to", filterTo);
    const r = await api.get(`/api/v1/payroll?${params}`);
    setPayments(r.data.payments || []);
    setTotal(r.data.total || 0);
  }

  useEffect(() => { load(); }, [filterFrom, filterTo]);

  function pickFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!form.staffName) return alert("กรุณาระบุชื่อพนักงาน");
    if (!form.amount)    return alert("กรุณาระบุจำนวนเงิน");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("staffName", form.staffName);
      fd.append("amount",    form.amount);
      fd.append("type",      form.type);
      fd.append("note",      form.note);
      if (slipFile) fd.append("slip", slipFile);
      await api.post("/api/v1/payroll", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm({ staffName: "", amount: "", type: "salary", note: "" });
      setSlipFile(null); setSlipPreview(null);
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm("ลบรายการนี้?")) return;
    await api.delete(`/api/v1/payroll/${id}`);
    load();
  }

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>💼 การเงิน — เบิกเงินพนักงาน</div>
          <div style={{ fontSize: 12, color: GRAY }}>รวม {total} รายการ • สำหรับ Finance เท่านั้น</div>
        </div>
        <button onClick={() => setShowForm(true)} style={btn(NAVY, WHITE)}>+ บันทึกการเงิน</button>
      </div>

      {/* Summary card */}
      {payments.length > 0 && (
        <div style={{ background: "#F0FDF4", border: `1.5px solid #6EE7B7`, borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: "#065F46", fontSize: 14 }}>รวมจ่ายพนักงาน (ที่กรอง)</span>
          <span style={{ fontWeight: 800, color: GREEN, fontSize: 18 }}>฿{totalAmount.toLocaleString()}</span>
        </div>
      )}

      {/* Filter */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...inp, width: "auto", flex: 1 }} />
        <input type="date" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   style={{ ...inp, width: "auto", flex: 1 }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(""); setFilterTo(""); }} style={btn("#F3F4F6", GRAY)}>ล้าง</button>
        )}
      </div>

      {/* List */}
      {payments.length === 0 ? (
        <div style={{ textAlign: "center", color: GRAY, padding: 40, fontSize: 14 }}>ยังไม่มีรายการ</div>
      ) : (
        payments.map(p => (
          <div key={p.id} style={{ background: WHITE, borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* Slip thumbnail */}
            <div style={{ flexShrink: 0 }}>
              {p.slipUrl ? (
                <img
                  src={p.slipUrl?.startsWith("http") ? p.slipUrl : `${API_URL}${p.slipUrl}`}
                  alt="slip"
                  onClick={() => setLightbox(p.slipUrl?.startsWith("http") ? p.slipUrl : `${API_URL}${p.slipUrl}`)}
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, cursor: "pointer", border: "1.5px solid #E5E7EB" }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 10, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💼</div>
              )}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ background: TYPE_COLOR[p.type] || "#F3F4F6", color: TYPE_TEXT[p.type] || GRAY, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  {TYPE_LABEL[p.type] || p.type}
                </span>
                <span style={{ fontWeight: 800, color: GREEN, fontSize: 16, whiteSpace: "nowrap" }}>฿{Number(p.amount).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: NAVY, fontWeight: 800 }}>👤 {p.staffName}</div>
              {p.note && <div style={{ marginTop: 4, fontSize: 13, color: "#374151" }}>{p.note}</div>}
              <div style={{ marginTop: 4, fontSize: 11, color: GRAY, display: "flex", gap: 8 }}>
                <span>{new Date(p.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                {p.createdByName && <span>• บันทึกโดย {p.createdByName}</span>}
              </div>
            </div>
            <button onClick={() => del(p.id)} style={{ ...btn("#FEE2E2", RED), padding: "6px 10px", flexShrink: 0 }}>ลบ</button>
          </div>
        ))
      )}

      {/* Add form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 18 }}>💼 บันทึกการเงินพนักงาน</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ชื่อพนักงาน *</label>
              <input value={form.staffName} onChange={e => setForm(f => ({ ...f, staffName: e.target.value }))} style={inp} placeholder="เช่น นก / ใบเตย / มงคล" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ประเภท</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                <option value="salary">💰 เงินเดือน</option>
                <option value="advance">💳 เบิกล่วงหน้า</option>
                <option value="bonus">🎁 โบนัส</option>
                <option value="other">📦 อื่นๆ</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>จำนวนเงิน (บาท) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} placeholder="5000" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>หมายเหตุ</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ ...inp, height: 72, resize: "vertical" }} placeholder="เช่น เงินเดือนเดือน ส.ค. / เบิกค่ารักษาพยาบาล..." />
            </div>

            {/* Slip upload */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>สลิปหลักฐาน (ถ้ามี)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickFile} style={{ display: "none" }} />
              {slipPreview ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={slipPreview} alt="preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1.5px solid #E5E7EB" }} />
                  <button onClick={() => { setSlipFile(null); setSlipPreview(null); }} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: RED, color: WHITE, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()} style={{ ...btn("#F3F4F6", GRAY), width: "100%", padding: 12 }}>
                  📷 ถ่ายรูป / เลือกรูป
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
