import { useState } from "react";

const ORANGE = "#F47B20";
const NAVY   = "#1A2B6B";
const GRAY   = "#6B7280";

export default function DiscountCode({ subtotal, zone, onApply, onRemove, applied }) {
  const [code, setCode]   = useState(applied?.code || "");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/discounts/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), subtotal, zone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onApply({ code: code.trim().toUpperCase(), discount: data.discount, description: data.description });
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setCode(""); setError(null);
    onRemove();
  }

  return (
    <div style={{ marginTop: 12, background: "#FFF7ED", borderRadius: 12, padding: 12, border: `1px solid ${ORANGE}30` }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>🎟 โค้ดส่วนลด</p>

      {applied ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            flex: 1, background: "#D1FAE5", borderRadius: 8, padding: "6px 12px",
            fontSize: 13, fontWeight: 700, color: "#065F46",
          }}>
            ✅ {applied.code} — ลด ฿{applied.discount}
            {applied.description && <span style={{ fontSize: 11, fontWeight: 400 }}> · {applied.description}</span>}
          </div>
          <button onClick={handleRemove} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 18, color: GRAY,
          }}>✕</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            placeholder="กรอกโค้ดส่วนลด"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: `2px solid ${error ? "#FCA5A5" : "#FED7AA"}`,
              fontSize: 13, letterSpacing: 1, fontWeight: 700,
            }}
          />
          <button onClick={handleApply} disabled={loading || !code.trim()} style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: loading || !code.trim() ? "#E5E7EB" : ORANGE,
            color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>
            {loading ? "..." : "ใช้โค้ด"}
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>⚠️ {error}</p>}
    </div>
  );
}
