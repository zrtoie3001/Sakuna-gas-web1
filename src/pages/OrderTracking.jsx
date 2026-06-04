import { useState, useEffect } from "react";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const GRAY   = "#6B7280";
const WHITE  = "#FFFFFF";

const STATUS_STEPS = [
  { key: "pending",            icon: "📋", label: "รับคำสั่งซื้อแล้ว" },
  { key: "preparing",          icon: "📦", label: "กำลังเตรียมสินค้า" },
  { key: "out_for_delivery",   icon: "🛵", label: "พนักงานออกส่งแล้ว" },
  { key: "near_destination",   icon: "📍", label: "ใกล้ถึงปลายทาง" },
  { key: "delivered",          icon: "✅", label: "ส่งสำเร็จแล้ว" },
];

export default function OrderTracking({ orderId, onBack }) {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [orderId]);

  async function fetchOrder() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/orders/${orderId}`);
      const data = await res.json();
      setOrder(data);
    } catch {/* silent */}
    finally { setLoading(false); }
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, color: GRAY, fontSize: 14 }}>
      กำลังโหลดสถานะ...
    </div>
  );

  if (!order) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <p style={{ color: GRAY }}>ไม่พบออเดอร์</p>
      <button onClick={onBack} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: NAVY, color: WHITE, border: "none", cursor: "pointer" }}>กลับหน้าหลัก</button>
    </div>
  );

  const currentIdx = STATUS_STEPS.findIndex(s => s.key === order.status);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FB", padding: "16px 16px 80px" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #0F1D52, ${NAVY})`,
        borderRadius: 16, padding: 16, marginBottom: 16, color: WHITE,
      }}>
        <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>ออเดอร์</p>
        <p style={{ fontSize: 22, fontWeight: 900, color: ORANGE }}># {order.orderNumber}</p>
        <p style={{ fontSize: 12, opacity: 0.8 }}>
          {order.brand?.name} · {order.product?.name} × {order.qty}
        </p>
        {order.estimatedMinutes && order.status !== "delivered" && order.status !== "cancelled" && (
          <p style={{ fontSize: 12, marginTop: 6, background: "rgba(255,255,255,.15)", display: "inline-block", padding: "3px 10px", borderRadius: 8 }}>
            ⏱ คาดว่าจะถึงในอีก ~{order.estimatedMinutes} นาที
          </p>
        )}
      </div>

      {/* Status Timeline */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 14 }}>สถานะการจัดส่ง</p>
        {STATUS_STEPS.map((step, idx) => {
          const done    = idx < currentIdx;
          const current = idx === currentIdx;
          const future  = idx > currentIdx;
          return (
            <div key={step.key} style={{ display: "flex", gap: 12, marginBottom: idx < STATUS_STEPS.length - 1 ? 0 : 0 }}>
              {/* Line + circle */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: done ? ORANGE : current ? NAVY : "#E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: current ? 18 : 14,
                  boxShadow: current ? `0 0 0 4px ${NAVY}30` : "none",
                  transition: "all .3s",
                }}>
                  {done ? "✓" : <span style={{ opacity: future ? 0.4 : 1 }}>{step.icon}</span>}
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 24, background: done ? ORANGE : "#E5E7EB", margin: "2px 0" }} />
                )}
              </div>

              {/* Label */}
              <div style={{ paddingBottom: idx < STATUS_STEPS.length - 1 ? 16 : 0, paddingTop: 4 }}>
                <p style={{
                  fontSize: current ? 14 : 13,
                  fontWeight: current ? 800 : done ? 600 : 400,
                  color: current ? NAVY : done ? "#374151" : "#9CA3AF",
                }}>{step.label}</p>
                {current && <p style={{ fontSize: 11, color: ORANGE, marginTop: 2 }}>● กำลังดำเนินการ</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Summary */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>สรุปออเดอร์</p>
        {[
          ["📍 ที่อยู่", order.deliveryAddress?.slice(0, 60) + (order.deliveryAddress?.length > 60 ? "..." : "")],
          ["💳 ชำระ",   order.paymentMethod === "cash" ? "เงินสด" : "QR โอน"],
          ["💰 ยอดรวม", `฿${Number(order.total).toLocaleString()}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
            <span style={{ color: GRAY }}>{k}</span>
            <span style={{ color: NAVY, fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={onBack} style={{
        width: "100%", marginTop: 14, padding: 14, borderRadius: 12,
        border: `2px solid ${NAVY}`, background: WHITE,
        color: NAVY, fontWeight: 700, fontSize: 14, cursor: "pointer",
      }}>
        ← กลับหน้าหลัก
      </button>
    </div>
  );
}
