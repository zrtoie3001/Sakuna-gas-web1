import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";
const PAGE_SIZE = 30;

function displayName(c) {
  if (c.name && c.name !== "ลูกค้าหน้าร้าน") return c.name;
  if (c.lastAddress) return c.lastAddress;
  if (c.phone) return c.phone;
  return "ไม่ระบุ";
}

function parseOrderLabel(o) {
  const n = o.note || "";
  if (n.match(/^__(?:phone_)?walkin:/)) {
    try {
      const w = JSON.parse(n.replace(/^__(?:phone_)?walkin:/, "").split("\n")[0]);
      if (w.type === "mixed") {
        return (w.items || []).map(i => `${i.brandName || ""} ${i.weightKg || ""}kg ×${i.qty || 1}`).join(", ");
      }
      if (w.type === "new_tank") return `ถังใหม่ ${w.brandName || ""} ${w.weightKg || ""}kg ×${w.qty || 1}`;
      if (w.type === "equipment") return w.itemName || "อุปกรณ์";
      return `${w.brandName || ""} ${w.weightKg || ""}kg ×${w.qty || 1}`;
    } catch { return "-"; }
  }
  if (o.product) return `${o.product.name || ""} ×${o.qty || 1}`;
  return `×${o.qty || 1}`;
}

function fmtDatetime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" })
    + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState(null);
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editForm, setEditForm]   = useState({ name: "", phone: "", address: "" });
  const [customerNote, setCustomerNote] = useState("");
  const [noteSaving, setNoteSaving]     = useState(false);
  const [custLocation, setCustLocation] = useState(null);
  const [locForm, setLocForm]           = useState(null); // null = view, {} = editing
  const [locSaving, setLocSaving]       = useState(false);
  const noteTimer = useRef(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/v1/customers?search=${encodeURIComponent(search)}&page=${page}&limit=${PAGE_SIZE}`).then(r => {
        setCustomers(r.data.customers);
        setTotal(r.data.total);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search, page]);

  async function selectCustomer(c) {
    setSelected(c);
    setEditing(false);
    setEditForm({ name: c.name || "", phone: c.phone || "", address: c.lastAddress || "" });
    setCustomerNote(""); setCustLocation(null); setLocForm(null);
    const params = new URLSearchParams();
    if (c.lastAddress) params.set("address", c.lastAddress);
    if (c.phone) params.set("phone", c.phone);
    if (c.name && c.name !== "ลูกค้าหน้าร้าน") params.set("name", c.name);
    const [ordersRes, noteRes, locRes] = await Promise.all([
      api.get(`/api/v1/customers/orders-by-contact?${params}`).catch(() => ({ data: { orders: [] } })),
      api.get(`/api/v1/customers/note?address=${encodeURIComponent(c.lastAddress || "")}&phone=${encodeURIComponent(c.phone || "")}`).catch(() => ({ data: { note: "" } })),
      api.get(`/api/v1/customers/location/by-contact?${c.phone ? "phone=" + encodeURIComponent(c.phone) : "address=" + encodeURIComponent(c.lastAddress || "")}`).catch(() => ({ data: null })),
    ]);
    setOrders(ordersRes.data.orders || []);
    setCustomerNote(noteRes.data.note || "");
    setCustLocation(locRes.data || null);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api.patch("/api/v1/customers/update-contact", {
        oldAddress: selected.lastAddress || "",
        oldPhone: selected.phone || "",
        newName: editForm.name || null,
        newPhone: editForm.phone || null,
        newAddress: editForm.address || null,
      });
      const updated = { ...selected, name: editForm.name || null, phone: editForm.phone || null, lastAddress: editForm.address || selected.lastAddress };
      setSelected(updated);
      setCustomers(prev => prev.map(c => c.id === selected.id ? updated : c));
      setEditing(false);
    } catch (e) {
      alert(e.response?.data?.error || "เกิดข้อผิดพลาด");
    } finally { setSaving(false); }
  }

  function onNoteChange(val) {
    setCustomerNote(val);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      setNoteSaving(true);
      await api.put("/api/v1/customers/note", { address: selected?.lastAddress || "", phone: selected?.phone || "", note: val }).catch(() => {});
      setNoteSaving(false);
    }, 800);
  }

  async function deleteCustomer() {
    if (!window.confirm(`ลบลูกค้า "${displayName(selected)}" ออกจากรายการ?\n\nออเดอร์ยังคงอยู่ แต่จะไม่แสดงในหน้าลูกค้าอีก`)) return;
    try {
      await api.delete("/api/v1/customers/delete-customer", { data: { address: selected.lastAddress } });
      setCustomers(prev => prev.filter(c => c.id !== selected.id));
      setTotal(t => t - 1);
      setSelected(null);
    } catch (e) {
      alert(e.response?.data?.error || "เกิดข้อผิดพลาด");
    }
  }

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 110px)" }}>
      {/* Left: customer list */}
      <div style={{ flex: "1 1 400px", minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>👥 ลูกค้า</h1>
          <span style={{ fontSize: 13, color: GRAY }}>{total} ราย</span>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ เบอร์ หรือที่อยู่"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />

        <div style={{ background: WHITE, borderRadius: 14, overflowY: "auto", boxShadow: "0 2px 12px rgba(0,0,0,.06)", flex: 1 }}>
          {customers.map(c => (
            <div key={c.id} onClick={() => selectCustomer(c)} style={{
              padding: "12px 16px", borderBottom: "1px solid #F3F4F6", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 12,
              background: selected?.id === c.id ? "#EEF2FF" : WHITE,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                {displayName(c)?.[0] || "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(c)}</p>
                {c.lastAddress && c.name && c.name !== "ลูกค้าหน้าร้าน" && (
                  <p style={{ fontSize: 11, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {c.lastAddress}</p>
                )}
                <p style={{ fontSize: 12, color: GRAY }}>{c.phone || ""}{c.phone ? " · " : ""}สั่ง {c.totalOrders} ครั้ง</p>
              </div>
            </div>
          ))}
          {!customers.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ไม่พบลูกค้า</p>}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0" }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: page <= 1 ? "#F9FAFB" : WHITE, color: page <= 1 ? GRAY : NAVY, cursor: page <= 1 ? "default" : "pointer", fontWeight: 700 }}>
              ← ก่อน
            </button>
            <span style={{ fontSize: 13, color: GRAY }}>หน้า {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: page >= totalPages ? "#F9FAFB" : WHITE, color: page >= totalPages ? GRAY : NAVY, cursor: page >= totalPages ? "default" : "pointer", fontWeight: 700 }}>
              ถัดไป →
            </button>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div style={{ flex: "0 0 340px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{displayName(selected)}</h2>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
          </div>

          {!editing ? (
            <>
              {selected.phone && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>📞 {selected.phone}</p>}
              {selected.name && selected.name !== "ลูกค้าหน้าร้าน" && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>👤 {selected.name}</p>}
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 8 }}>สั่งทั้งหมด {selected.totalOrders} ครั้ง</p>
              {selected.lastAddress && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>ที่อยู่ล่าสุด</p>
                  <div style={{ padding: "8px 10px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: GRAY }}>📍 {selected.lastAddress}</div>
                </div>
              )}
              <button onClick={() => setEditing(true)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                ✏️ แก้ไขข้อมูลลูกค้า
              </button>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              {[["👤 ชื่อ", "name", "text"], ["📞 เบอร์โทร", "phone", "tel"], ["📍 ที่อยู่", "address", "text"]].map(([label, field, type]) => (
                <div key={field} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, display: "block", marginBottom: 3 }}>{label}</label>
                  <input type={type} value={editForm[field]} onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Customer note */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: NAVY, display: "block", marginBottom: 3 }}>
              📝 โน้ตลูกค้า {noteSaving && <span style={{ color: ORANGE, fontWeight: 400 }}>กำลังบันทึก...</span>}
            </label>
            <textarea
              value={customerNote}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="เช่น บ้านชั้น 2, ระวังสุนัข, รับเฉพาะช่วงเช้า..."
              rows={3}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, boxSizing: "border-box", resize: "vertical", background: customerNote ? "#FFFBEB" : "#FAFAFA" }}
            />
          </div>

          {/* Location section */}
          <div style={{ marginBottom: 14, background: "#F0F9FF", borderRadius: 10, padding: "12px 14px", border: "1.5px solid #BAE6FD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0369A1" }}>📍 สถานที่จัดส่ง</span>
                {" "}
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                  background: custLocation ? (custLocation.locationAccuracy === "EXACT" ? "#D1FAE5" : "#FEF3C7") : "#FEE2E2",
                  color: custLocation ? (custLocation.locationAccuracy === "EXACT" ? "#065F46" : "#92400E") : "#991B1B" }}>
                  {custLocation ? (custLocation.locationAccuracy === "EXACT" ? "🟢 มีพิกัดแล้ว" : "🟡 พิกัดโดยประมาณ") : "🔴 ยังไม่มีพิกัด"}
                </span>
              </div>
              <button onClick={() => setLocForm(custLocation ? { ...custLocation } : { latitude: "", longitude: "", locationName: "", addressText: "", locationNote: "", locationAccuracy: "EXACT" })}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1.5px solid #0369A1", background: WHITE, color: "#0369A1", fontWeight: 700, cursor: "pointer" }}>
                {custLocation ? "✏️ แก้ไข" : "+ เพิ่มพิกัด"}
              </button>
            </div>

            {locForm ? (
              <div>
                {[
                  ["ชื่อที่ลูกค้าเรียก", "locationName", "text"],
                  ["Latitude", "latitude", "number"],
                  ["Longitude", "longitude", "number"],
                  ["ที่อยู่จริง", "addressText", "text"],
                  ["รายละเอียด / จุดสังเกต", "locationNote", "text"],
                ].map(([lbl, key, type]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, marginBottom: 2 }}>{lbl}</div>
                    <input type={type} value={locForm[key] || ""} onChange={e => setLocForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1.5px solid #BAE6FD", fontSize: 12, boxSizing: "border-box" }} />
                  </div>
                ))}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, marginBottom: 2 }}>ความแม่นยำ</div>
                  <select value={locForm.locationAccuracy || "EXACT"} onChange={e => setLocForm(f => ({ ...f, locationAccuracy: e.target.value }))}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1.5px solid #BAE6FD", fontSize: 12, boxSizing: "border-box" }}>
                    <option value="EXACT">🟢 พิกัดแม่นยำ</option>
                    <option value="APPROXIMATE">🟡 พิกัดโดยประมาณ</option>
                    <option value="UNKNOWN">🔴 ไม่ทราบ</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={async () => {
                    if (!locForm.latitude || !locForm.longitude) return alert("ต้องระบุ Latitude และ Longitude");
                    setLocSaving(true);
                    try {
                      const payload = { ...locForm,
                        customerPhone: selected.phone || "",
                        customerAddress: selected.lastAddress || "",
                        source: "ADMIN_LOCATION" };
                      const r = custLocation
                        ? await api.put(`/api/v1/customers/location/${custLocation.id}`, payload)
                        : await api.post("/api/v1/customers/location/save", payload);
                      setCustLocation(r.data); setLocForm(null);
                    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
                    setLocSaving(false);
                  }} disabled={locSaving} style={{ flex: 2, padding: "7px", borderRadius: 8, border: "none", background: NAVY, color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {locSaving ? "กำลังบันทึก..." : "💾 บันทึก"}
                  </button>
                  <button onClick={() => setLocForm(null)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : custLocation ? (
              <div style={{ fontSize: 12, color: "#0C4A6E" }}>
                {custLocation.locationName && <div style={{ fontWeight: 700, marginBottom: 4 }}>🏠 {custLocation.locationName}</div>}
                {custLocation.addressText && <div style={{ marginBottom: 4, color: GRAY }}>📌 {custLocation.addressText}</div>}
                {custLocation.locationNote && <div style={{ marginBottom: 6, color: "#374151" }}>📝 {custLocation.locationNote}</div>}
                <div style={{ marginBottom: 6, fontFamily: "monospace", fontSize: 11, color: GRAY }}>
                  {Number(custLocation.latitude).toFixed(6)}, {Number(custLocation.longitude).toFixed(6)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`https://www.google.com/maps?q=${custLocation.latitude},${custLocation.longitude}`}
                    target="_blank" rel="noreferrer"
                    style={{ flex: 1, padding: "6px", borderRadius: 7, background: "#0369A1", color: WHITE, fontWeight: 700, fontSize: 11, textAlign: "center", textDecoration: "none" }}>
                    📍 ดูแผนที่
                  </a>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${custLocation.latitude},${custLocation.longitude}`}
                    target="_blank" rel="noreferrer"
                    style={{ flex: 1, padding: "6px", borderRadius: 7, background: "#7C3AED", color: WHITE, fontWeight: 700, fontSize: 11, textAlign: "center", textDecoration: "none" }}>
                    🧭 นำทาง
                  </a>
                </div>
                {custLocation.createdByName && (
                  <div style={{ marginTop: 6, fontSize: 10, color: GRAY }}>
                    บันทึกโดย: {custLocation.createdByName} · {new Date(custLocation.updatedAt).toLocaleDateString("th-TH")}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: GRAY, textAlign: "center", padding: "8px 0" }}>
                ยังไม่มีพิกัด — พนักงานสามารถบันทึกได้เมื่อถึงหน้าบ้านลูกค้า
              </div>
            )}
          </div>

          <button onClick={deleteCustomer} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
            🗑️ ลบออกจากรายการ
          </button>

          {/* Order history */}
          <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>ประวัติออเดอร์</p>
          {orders.map(o => (
            <div key={o.id} onClick={() => navigate(`/orders?q=${o.orderNumber}`)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 6, fontSize: 12, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F0F9FF"}
              onMouseLeave={e => e.currentTarget.style.background = WHITE}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ color: ORANGE, fontWeight: 700 }}>{o.orderNumber}</span>
                <span style={{ color: GRAY, fontSize: 11 }}>{fmtDatetime(o.createdAt)}</span>
              </div>
              <p style={{ color: NAVY, marginBottom: 1 }}>{parseOrderLabel(o)}</p>
              <div style={{ display: "flex", justifyContent: "space-between", color: GRAY }}>
                <span>฿{Number(o.total).toLocaleString()}</span>
                <span style={{ fontSize: 10, background: o.isPaid ? "#D1FAE5" : "#FEF3C7", color: o.isPaid ? "#065F46" : "#92400E", padding: "1px 5px", borderRadius: 4 }}>
                  {o.isPaid ? "ชำระแล้ว" : "ค้างชำระ"}
                </span>
              </div>
              {o.note && !o.note.match(/^__/) && (
                <p style={{ color: GRAY, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>📝 {o.note}</p>
              )}
            </div>
          ))}
          {!orders.length && <p style={{ color: GRAY, fontSize: 12 }}>ยังไม่มีประวัติ</p>}
        </div>
      )}
    </div>
  );
}
