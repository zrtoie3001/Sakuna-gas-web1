import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

const EMPTY = { type: "fixed", value: "", code: "", maxUses: "", expiresAt: "", description: "", minOrderAmount: "0", allowedProducts: [] };

export default function Discounts() {
  const [codes, setCodes]       = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal]       = useState(false);
  const [editId, setEditId]     = useState(null); // null = create, string = edit
  const [form, setForm]         = useState(EMPTY);

  const load = () => api.get("/api/v1/discounts").then(r => setCodes(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/api/v1/products").then(r => setProducts(Array.isArray(r.data) ? r.data : r.data.products || [])).catch(() => {});
  }, []);

  function openCreate() { setEditId(null); setForm(EMPTY); setModal(true); }
  function openEdit(c) {
    setEditId(c.id);
    setForm({
      code: c.code, type: c.type,
      value: String(c.value),
      minOrderAmount: String(c.minOrderAmount ?? "0"),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      description: c.description || "",
      allowedProducts: c.allowedProducts || [],
    });
    setModal(true);
  }

  async function save() {
    try {
      const payload = {
        ...form,
        value: Number(form.value),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        minOrderAmount: Number(form.minOrderAmount),
        expiresAt: form.expiresAt || null,
        allowedProducts: form.allowedProducts.length ? form.allowedProducts : null,
      };
      if (editId) await api.put(`/api/v1/discounts/${editId}`, payload);
      else await api.post("/api/v1/discounts", payload);
      setModal(false); setForm(EMPTY); setEditId(null); load();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  async function toggle(id, isActive) {
    try { await api.put(`/api/v1/discounts/${id}`, { isActive }); load(); }
    catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  async function remove(id) {
    if (!confirm("ลบโค้ดนี้?")) return;
    try { await api.delete(`/api/v1/discounts/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error || "ลบไม่ได้: " + e.message); }
  }

  function toggleProduct(pid) {
    setForm(f => ({
      ...f,
      allowedProducts: f.allowedProducts.includes(pid)
        ? f.allowedProducts.filter(x => x !== pid)
        : [...f.allowedProducts, pid],
    }));
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
        <button onClick={openCreate} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: NAVY, color: WHITE, border: "none", fontSize: 13, fontWeight: 700 }}>+ สร้างโค้ด</button>
      </div>

      <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {["โค้ด", "ประเภท", "ส่วนลด", "ใช้ได้กับ", "ใช้แล้ว/จำกัด", "หมดอายุ", "สถานะ", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: GRAY, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map(c => {
              const expired = c.expiresAt && new Date() > new Date(c.expiresAt);
              const full    = c.maxUses && c.usedCount >= c.maxUses;
              const allowedNames = c.allowedProducts?.length
                ? c.allowedProducts.map(pid => products.find(p => p.id === pid)?.name || "?").join(", ")
                : "ทุกสินค้า";
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #F3F4F6", opacity: c.isActive && !expired && !full ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px", fontWeight: 800, color: ORANGE, letterSpacing: 1 }}>{c.code}</td>
                  <td style={{ padding: "10px 12px" }}>{c.type === "fixed" ? "💵 จำนวนเงิน" : "📊 เปอร์เซ็นต์"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: NAVY }}>
                    {c.type === "fixed" ? `฿${Number(c.value).toLocaleString()}` : `${c.value}%`}
                  </td>
                  <td style={{ padding: "10px 12px", color: GRAY, fontSize: 12 }}>{allowedNames}</td>
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
                      <button onClick={() => openEdit(c)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #6B7280", background: WHITE, color: "#374151", fontSize: 11, fontWeight: 700 }}>
                        แก้ไข
                      </button>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, margin: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{editId ? "แก้ไขโค้ดส่วนลด" : "สร้างโค้ดส่วนลด"}</h2>
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

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 6, fontWeight: 700 }}>
                ใช้ได้กับสินค้า (ไม่เลือก = ทุกสินค้า)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {products.map(p => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                    padding: "8px 12px", borderRadius: 8,
                    background: form.allowedProducts.includes(p.id) ? "#EEF2FF" : "#F8FAFC",
                    border: `1.5px solid ${form.allowedProducts.includes(p.id) ? NAVY : "#E5E7EB"}` }}>
                    <input type="checkbox" checked={form.allowedProducts.includes(p.id)}
                      onChange={() => toggleProduct(p.id)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: GRAY, marginLeft: "auto" }}>฿{Number(p.homePrice).toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </div>

            <F label="คำอธิบาย" k="description" />

            <button onClick={save} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none",
              background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14 }}>
              {editId ? "บันทึกการแก้ไข" : "สร้างโค้ด"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
