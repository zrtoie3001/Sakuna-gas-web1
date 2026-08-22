import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

function displayName(c) {
  if (c.lastAddress) return c.lastAddress;
  if (c.name && c.name !== "ลูกค้าหน้าร้าน") return c.name;
  if (c.phone) return c.phone;
  return "ไม่ระบุ";
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/v1/customers?search=${search}`).then(r => {
        setCustomers(r.data.customers);
        setTotal(r.data.total);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function selectCustomer(c) {
    setSelected(c);
    const params = new URLSearchParams();
    if (c.phone) params.set("phone", c.phone);
    else if (c.lastAddress) params.set("address", c.lastAddress);
    else if (c.name) params.set("name", c.name);
    const r = await api.get(`/api/v1/customers/orders-by-contact?${params}`);
    setOrders(r.data.orders || []);
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 400px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>👥 ลูกค้า</h1>
          <span style={{ fontSize: 13, color: GRAY }}>{total} ราย</span>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อหรือเบอร์โทร"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 14, marginBottom: 12 }} />

        <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
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
                <p style={{ fontSize: 12, color: GRAY }}>{c.phone || ""}{c.phone && c.totalOrders ? " · " : ""}สั่ง {c.totalOrders} ครั้ง</p>
              </div>
            </div>
          ))}
          {!customers.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ไม่พบลูกค้า</p>}
        </div>
      </div>

      {selected && (
        <div style={{ flex: "0 0 320px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", position: "sticky", top: 16, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{displayName(selected)}</h2>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
          </div>
          {selected.phone && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>📞 {selected.phone}</p>}
          {selected.name && selected.name !== "ลูกค้าหน้าร้าน" && <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>👤 {selected.name}</p>}
          <p style={{ fontSize: 13, color: GRAY, marginBottom: 12 }}>สั่งทั้งหมด {selected.totalOrders} ครั้ง</p>

          {selected.lastAddress && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 4 }}>ที่อยู่ล่าสุด</p>
              <div style={{ padding: "8px 10px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: GRAY }}>
                📍 {selected.lastAddress}
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>ประวัติออเดอร์</p>
          {orders.slice(0, 10).map(o => (
            <div key={o.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 6, fontSize: 12 }}>
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
