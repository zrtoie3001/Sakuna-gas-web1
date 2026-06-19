import { useState, useEffect } from "react";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const PROMPTPAY_ID = import.meta.env.VITE_PROMPTPAY_ID || "0971213054";

export default function QRPayment({ order, onDone }) {
  const total = Number(order.total);
  const [svgData, setSvgData] = useState("");

  useEffect(() => {
    const payload = generatePayload(PROMPTPAY_ID, { amount: total });
    QRCode.toString(payload, {
      type: "svg",
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then(setSvgData).catch(() => {});
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

        {/* QR Code SVG */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            padding: 16, background: WHITE, borderRadius: 20,
            boxShadow: "0 2px 16px rgba(0,0,0,.10)",
            border: "1.5px solid #E5E7EB",
            display: "inline-block",
          }}>
            {svgData
              ? <div dangerouslySetInnerHTML={{ __html: svgData }}
                  style={{ width: 240, height: 240, display: "block" }} />
              : <div style={{ width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: GRAY, fontSize: 13 }}>กำลังโหลด...</div>
            }
          </div>
        </div>

        <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>
          สแกนด้วยแอปธนาคารหรือวอลเล็ต
        </div>
        <div style={{ fontSize: 12, color: NAVY, fontWeight: 700, marginBottom: 24, background: "#F0F3FF",
          borderRadius: 10, padding: "8px 14px", display: "inline-block" }}>
          PromptPay · {PROMPTPAY_ID}
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
