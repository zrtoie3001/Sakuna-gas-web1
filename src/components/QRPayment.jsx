import { useEffect, useRef } from "react";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const PROMPTPAY_ID = import.meta.env.VITE_PROMPTPAY_ID || "0971213054";

export default function QRPayment({ order, onDone }) {
  const canvasRef = useRef(null);
  const total = Number(order.total);

  useEffect(() => {
    const payload = generatePayload(PROMPTPAY_ID, { amount: total });
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 2,
      color: { dark: "#1A2B6B", light: "#FFFFFF" },
    });
  }, [total]);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FB",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: WHITE, borderRadius: 24, padding: 28,
        maxWidth: 380, width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px rgba(0,0,0,.12)" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${NAVY2},${NAVY})`,
          borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ color: WHITE, fontWeight: 900, fontSize: 18 }}>📱 สแกนจ่ายเงิน</div>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 4 }}>
            สกุณาแก๊ส · PromptPay
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: ORANGE }}>
            ฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>
            ออเดอร์ #{order.orderNumber}
          </div>
        </div>

        {/* QR Code */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ padding: 12, border: `3px solid ${NAVY}`, borderRadius: 16,
            background: WHITE, display: "inline-block" }}>
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>
        </div>

        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>
          สแกน QR ด้วยแอปธนาคารหรือวอลเล็ตของคุณ
        </div>
        <div style={{ fontSize: 11, color: GRAY, marginBottom: 24, background: "#F8FAFC",
          borderRadius: 10, padding: "8px 14px" }}>
          📞 PromptPay: <strong style={{ color: NAVY }}>{PROMPTPAY_ID}</strong>
        </div>

        {/* Confirm button */}
        <button onClick={onDone} style={{
          width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
          background: `linear-gradient(135deg,${NAVY},${NAVY2})`,
          color: WHITE, fontWeight: 800, fontSize: 15, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(26,43,107,.3)",
        }}>
          ✅ ชำระเงินแล้ว
        </button>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 10 }}>
          กดหลังจากสแกนและชำระเงินเรียบร้อยแล้ว
        </div>
      </div>
    </div>
  );
}
