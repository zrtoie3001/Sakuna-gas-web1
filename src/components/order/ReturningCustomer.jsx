const NAVY  = "#1A2B6B";
const ORANGE= "#F47B20";
const GRAY  = "#6B7280";
const WHITE = "#FFFFFF";

export default function ReturningCustomer({ customer, onUseAddress, onNewAddress }) {
  if (!customer) return null;
  const defaultAddr = customer.addresses?.find(a => a.isDefault) || customer.addresses?.[0];
  const recentOrder = customer.recentOrders?.[0];

  return (
    <div style={{
      background: "#EEF2FF", borderRadius: 14, padding: 14,
      border: "2px solid #C7D2FE", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {customer.pictureUrl && (
          <img src={customer.pictureUrl} alt="profile"
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
        )}
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
            ยินดีต้อนรับกลับ, {customer.name}! 👋
          </p>
          <p style={{ fontSize: 11, color: GRAY }}>
            สั่งซื้อไปแล้ว {customer.totalOrders} ครั้ง
            {recentOrder && ` · ออเดอร์ล่าสุด: ${recentOrder.product?.name}`}
          </p>
        </div>
      </div>

      {defaultAddr && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>ที่อยู่ล่าสุด</p>
          <p style={{ fontSize: 12, color: NAVY, fontWeight: 600, lineHeight: 1.5 }}>
            📍 {defaultAddr.address?.slice(0, 60)}...
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {defaultAddr && (
          <button onClick={() => onUseAddress(defaultAddr)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${NAVY}`,
            background: NAVY, color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            ✅ ใช้ที่อยู่เดิม
          </button>
        )}
        <button onClick={onNewAddress} style={{
          flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${ORANGE}`,
          background: WHITE, color: ORANGE, fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          ➕ เพิ่มที่อยู่ใหม่
        </button>
      </div>

      {customer.addresses?.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>ที่อยู่ที่บันทึกไว้</p>
          {customer.addresses.map(addr => (
            <div key={addr.id} onClick={() => onUseAddress(addr)} style={{
              padding: "8px 10px", borderRadius: 8, background: WHITE,
              border: "1.5px solid #E5E7EB", marginBottom: 6, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{
                addr.label === "บ้าน" ? "🏠" :
                addr.label === "ร้านค้า" ? "🏪" :
                addr.label === "คอนโด" ? "🏢" : "📍"
              }</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{addr.label}</p>
                <p style={{ fontSize: 11, color: GRAY, lineHeight: 1.4 }}>{addr.address?.slice(0, 50)}...</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
