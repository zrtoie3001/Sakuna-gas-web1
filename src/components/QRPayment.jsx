import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "";
const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

export default function QRPayment({ order, onDone }) {
  const total = Number(order.total);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    await fetch(`${API}/api/v1/orders/${order.id}/payment-confirmed`, { method: "POST" }).catch(() => {});
    setConfirming(false);
    onDone();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${NAVY2} 0%, ${NAVY} 50%, #2D3F8F 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: WHITE, borderRadius: 28, padding: "28px 24px",
        maxWidth: 360, width: "100%", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
      }}>

        {/* Logo + title */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>ชำระเงินผ่าน PromptPay</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>
            สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
          </div>
        </div>

        {/* Amount box */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY2}, ${NAVY})`,
          borderRadius: 16, padding: "14px 20px", marginBottom: 22,
        }}>
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12, marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
          <div style={{ color: WHITE, fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
            ฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 4 }}>
            ออเดอร์ #{order.orderNumber}
          </div>
        </div>

        {/* QR image */}
        <div style={{
          display: "inline-block",
          padding: 14,
          background: WHITE,
          borderRadius: 20,
          boxShadow: "0 4px 24px rgba(0,0,0,.12)",
          border: "1.5px solid #E5E7EB",
          marginBottom: 18,
        }}>
          <img
            src="/images/qr-promptpay.png"
            alt="QR PromptPay"
            style={{ width: 230, height: 230, objectFit: "contain", display: "block" }}
          />
        </div>

        {/* Account info */}
        <div style={{
          background: "#F8FAFF",
          borderRadius: 14,
          padding: "12px 16px",
          marginBottom: 22,
          border: "1px solid #E5E7EB",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>นาง รุจิรา ดวงเพ็ชรแสง</div>
          <div style={{ fontSize: 12, color: GRAY }}>PromptPay · ธนาคารกสิกรไทย</div>
        </div>

        {/* Confirm */}
        <button onClick={handleConfirm} disabled={confirming} style={{
          width: "100%", padding: "15px 0", borderRadius: 16, border: "none",
          background: `linear-gradient(135deg, #059669, #047857)`,
          color: WHITE, fontWeight: 800, fontSize: 16, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(5,150,105,.35)",
          letterSpacing: 0.5,
        }}>
          {confirming ? "กำลังแจ้ง..." : "✅ โอนเงินเรียบร้อยแล้ว"}
        </button>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 10 }}>
          กดหลังจากสแกนและโอนเงินเสร็จแล้ว
        </div>
      </div>
    </div>
  );
}
