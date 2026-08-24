import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY  = "#1E3A5F";
const WHITE = "#FFFFFF";
const GRAY  = "#6B7280";
const GREEN = "#059669";
const RED   = "#DC2626";
const ORANGE = "#D97706";

const btn = (bg, color) => ({
  background: bg, color, border: "none", borderRadius: 10, padding: "8px 16px",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
});
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

function Card({ label, value, color, sub }) {
  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.07)", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: GRAY, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function CashBalance() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load(d) {
    setLoading(true);
    try {
      const r = await api.get(`/api/v1/cash-float?date=${d}`);
      setData(r.data);
      setStartInput(String(r.data.startAmount || ""));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(date); }, [date]);

  async function saveStart() {
    setSaving(true);
    try {
      await api.post("/api/v1/cash-float", { date, startAmount: Number(startInput) || 0 });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load(date);
    } finally {
      setSaving(false);
    }
  }

  const balance = data ? data.balance : 0;
  const balanceColor = balance >= 0 ? GREEN : RED;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 4 }}>💵 ยอดเงินสดคงเหลือ</div>
      <div style={{ fontSize: 12, color: GRAY, marginBottom: 20 }}>ติดตามเงินสดประจำวัน</div>

      {/* Date picker */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>เลือกวันที่</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: "auto", flex: 1 }} />
        <button onClick={() => setDate(today)} style={btn("#EFF6FF", "#1D4ED8")}>วันนี้</button>
      </div>

      {/* Starting amount */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>ยอดตั้งต้น (เงินที่มีตอนเช้า)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            placeholder="เช่น 500"
            style={{ ...inp, flex: 1 }}
          />
          <button onClick={saveStart} disabled={saving} style={{ ...btn(NAVY, WHITE), whiteSpace: "nowrap", opacity: saving ? 0.7 : 1 }}>
            {saved ? "✓ บันทึกแล้ว" : saving ? "..." : "บันทึก"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div style={{ textAlign: "center", color: GRAY, padding: 32 }}>กำลังโหลด...</div>
      ) : data && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Card label="ยอดตั้งต้น" value={`฿${Number(data.startAmount).toLocaleString()}`} color={NAVY} />
            <Card label="รายรับสด (ออเดอร์)" value={`+฿${Number(data.cashIn).toLocaleString()}`} color={GREEN} sub={`${data.cashOrders} รายการ`} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Card label="รายจ่าย" value={`-฿${Number(data.cashOut).toLocaleString()}`} color={ORANGE} />
            <Card label="เก็บเงินนำส่ง" value={`-฿${Number(data.collected).toLocaleString()}`} color={RED} />
          </div>

          {/* Balance */}
          <div style={{ background: balance >= 0 ? "#F0FDF4" : "#FEF2F2", border: `2px solid ${balanceColor}`, borderRadius: 16, padding: "20px 24px", textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: balanceColor, fontWeight: 700, marginBottom: 6 }}>ยอดเงินสดคงเหลือ</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: balanceColor }}>
              ฿{Number(balance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 8 }}>
              {data.startAmount} + {data.cashIn} − {data.cashOut} − {data.collected} = {balance}
            </div>
          </div>

          {/* Expense list */}
          {data.expenses && data.expenses.length > 0 && (
            <div style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>รายการจ่ายเงิน/เก็บเงิน</div>
              {data.expenses.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < data.expenses.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <div>
                    <span style={{ fontSize: 12, color: e.type === "collect" ? RED : ORANGE, fontWeight: 700 }}>
                      {e.type === "collect" ? "💵 เก็บเงินนำส่ง" : e.type === "fuel" ? "⛽ น้ำมัน" : e.type === "lift" ? "🏗️ ค่ายก" : e.type === "repair" ? "🔧 ซ่อม" : "📦 " + (e.description || e.type)}
                    </span>
                    {e.description && e.type !== "other" && <span style={{ fontSize: 11, color: GRAY, marginLeft: 6 }}>{e.description}</span>}
                    {e.createdByName && <span style={{ fontSize: 11, color: GRAY, marginLeft: 6 }}>· {e.createdByName}</span>}
                  </div>
                  <span style={{ fontWeight: 800, color: e.type === "collect" ? RED : ORANGE, fontSize: 14 }}>฿{Number(e.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
