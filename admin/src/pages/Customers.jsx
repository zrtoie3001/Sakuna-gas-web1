import { useState, useEffect } from "react";
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

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState(null);
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving]       = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

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
    const params = new URLSearchParams();
    if (c.phone) params.set("phone", c.phone);
    else if (c.lastAddress) params.set("address", c.lastAddress);
    else if (c.name) params.set("name", c.name);
    const r = await api.get(`/api/v1/customers/orders-by-contact?${params}`);
    setOrders(r.data.orders || []);
  }

  function startEdit() {
    setEditForm({ name: selected.name || "", phone: selected.phone || "", address: selected.lastAddress || "" });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api.patch("/api/v1/customers/update-contact", {
        oldAddress: selected.lastAddress || "",
        oldPhone:   selected.phone || "",
        newName:    editForm.name || null,
        newPhone:   editForm.phone || null,
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

        <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)", flex: 1 }}>
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: page === 1 ? "#F3F4F6" : WHITE, color: page === 1 ? GRAY : NAVY, fontWeight: 700, fontSize: 13, cursor: page === 1 ? "default" : "pointer" }}>
              ← ก่อน
            </button>
            <span style={{ fontSize: 13, color: GRAY }}>หน้า {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: page === totalPages ? "#F3F4F6" : WHITE, color: page === totalPages ? GRAY : NAVY, fontWeight: 700, fontSize: 13, cursor: page === totalPages ? "default" : "pointer" }}>
              ถัดไป →
            </button>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div style={{ flex: "0 0 320px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{displayName(selected)}</h2>
            <button onClick={() => { setSelected(null); setEditing(false); }} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
          </div>

          {!editing ? (
            <>
              {selected.phone && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>📞 {selected.phone}</p>}
              {selected.name && selected.name !== "ลูกค้าหน้าร้าน" && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>👤 {selected.name}</p>}
              <p style={{ fontSize: 13, color: GRAY, marginBottom: 8 }}>สั่งทั้งหมด {selected.totalOrders} ครั้ง</p>

              {selected.lastAddress && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>ที่อยู่ล่าสุด</p>
                  <div style={{ padding: "8px 10px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: GRAY }}>
                    📍 {selected.lastAddress}
                  </div>
                </div>
              )}

              <button onClick={startEdit} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                ✏️ แก้ไขข้อมูลลูกค้า
              </button>
              <button onClick={deleteCustomer} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1.5px solid #FCA5A5", background: "#FFF5F5", color: "#DC2626", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
                🗑️ ลบออกจากรายการ
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

          <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>ประวัติออเดอร์</p>
          {orders.slice(0, 10).map(o => (
            <div key={o.id} onClick={() => navigate(`/orders?q=${o.orderNumber}`)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 6, fontSize: 12, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F0F9FF"}
              onMouseLeave={e => e.currentTarget.style.background = WHITE}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: ORANGE, fontWeight: 700 }}>{o.orderNumber}</span>
                <span style={{ color: GRAY }}>{new Date(o.createdAt).toLocaleDateString("th-TH")}</span>
              </div>
              <p style={{ color: NAVY, marginTop: 2 }}>{o.product?.name} × {o.qty} · ฿{Number(o.total).toLocaleString()}</p>
            </div>
          ))}
          {!orders.length && <p style={{ color: GRAY, fontSize: 12 }}>ยังไม่มีประวัติ</p>}
        </div>
      )}
    </div>
  );
}
