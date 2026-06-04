import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF"; const GRAY = "#6B7280";

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
    const r = await api.get(`/api/v1/customers/${c.id}/orders`);
    setOrders(r.data.orders);
  }

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 400px" }}>
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
              {c.pictureUrl
                ? <img src={c.pictureUrl} alt="pic" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 40, height: 40, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: WHITE, fontSize: 16, fontWeight: 800 }}>{c.name?.[0] || "?"}</div>
              }
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{c.name || "ไม่ระบุชื่อ"}</p>
                <p style={{ fontSize: 12, color: GRAY }}>{c.phone} · สั่ง {c.totalOrders} ครั้ง</p>
              </div>
            </div>
          ))}
          {!customers.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ไม่พบลูกค้า</p>}
        </div>
      </div>

      {selected && (
        <div style={{ flex: "0 0 320px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{selected.name}</h2>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
          </div>
          <p style={{ fontSize: 13, color: GRAY, marginBottom: 12 }}>📞 {selected.phone} · สั่ง {selected.totalOrders} ครั้ง</p>

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>ที่อยู่ที่บันทึก</p>
            {selected.addresses?.map(a => (
              <div key={a.id} style={{ padding: "8px 10px", background: "#F8FAFC", borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: NAVY }}>{a.label} {a.isDefault ? "⭐" : ""}</span>
                <p style={{ color: GRAY, marginTop: 2 }}>{a.address?.slice(0, 60)}...</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>ประวัติออเดอร์</p>
          {orders.slice(0, 5).map(o => (
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
