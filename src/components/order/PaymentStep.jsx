import { useState } from "react";

const NAVY  = "#1A2B6B";
const GRAY  = "#6B7280";
const WHITE = "#FFFFFF";

export default function PaymentStep({ total, selected, onSelect, orderId, onSlipUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [slipUrl, setSlipUrl]     = useState(null);
  const qrImage = import.meta.env.VITE_QR_IMAGE_URL || null;

  async function handleSlipUpload(e) {
    const file = e.target.files[0];
    if (!file || !orderId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("slip", file);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/orders/${orderId}/slip`, {
        method: "POST", body: fd,
      });
      const data = await res.json();
      setSlipUrl(data.slipUrl);
      onSlipUploaded?.(data.slipUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>💳 เลือกวิธีชำระเงิน</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {[
          { id: "cash", icon: "💵", label: "เงินสด", desc: "ชำระตอนรับของ" },
          { id: "qr",   icon: "📱", label: "QR โอน", desc: "สแกน QR ชำระล่วงหน้า" },
        ].map(m => (
          <div key={m.id} onClick={() => onSelect(m.id)} style={{
            flex: 1, padding: "12px 10px", borderRadius: 12,
            border: `2px solid ${selected === m.id ? NAVY : "#E5E7EB"}`,
            background: selected === m.id ? "#EEF2FF" : WHITE,
            cursor: "pointer", textAlign: "center",
          }}>
            <div style={{ fontSize: 24 }}>{m.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{m.label}</div>
            <div style={{ fontSize: 10, color: GRAY }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {selected === "qr" && (
        <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 16, textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            ยอดชำระ <span style={{ color: "#F47B20", fontSize: 20 }}>฿{total.toLocaleString()}</span>
          </p>
          {qrImage ? (
            <img src={qrImage} alt="QR" style={{ width: 180, height: 180, borderRadius: 8 }} />
          ) : (
            <div style={{ width: 180, height: 180, background: "#E5E7EB", borderRadius: 8, margin: "0 auto",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: GRAY }}>
              QR Code จะแสดงหลังยืนยัน
            </div>
          )}
          <p style={{ fontSize: 11, color: GRAY, marginTop: 8 }}>สแกนด้วยแอปธนาคารหรือ PromptPay</p>

          {slipUrl ? (
            <div style={{ marginTop: 10, padding: 8, background: "#D1FAE5", borderRadius: 8, fontSize: 12, color: "#065F46" }}>
              ✅ อัปโหลดสลิปแล้ว
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <label style={{
                display: "inline-block", padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                background: NAVY, color: WHITE, fontSize: 12, fontWeight: 700,
              }}>
                {uploading ? "กำลังอัปโหลด..." : "📷 แนบสลิปโอนเงิน"}
                <input type="file" accept="image/*" onChange={handleSlipUpload}
                  style={{ display: "none" }} disabled={uploading} />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
