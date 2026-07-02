import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY = "#1B2A6B";
const ORANGE = "#E8873A";
const WHITE = "#FFFFFF";
const GRAY = "#6B7280";

export default function Settings() {
  const [setting, setSetting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/api/v1/settings/store").then(r => setSetting(r.data)).catch(() => {});
  }, []);

  async function save(patch) {
    setSaving(true);
    const r = await api.put("/api/v1/settings/store", patch);
    setSetting(r.data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!setting) return <p style={{ color: GRAY, padding: 24 }}>กำลังโหลด...</p>;

  const inp = { border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", width: "100%", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ maxWidth: 600, padding: 24 }}>
      <h2 style={{ color: NAVY, margin: "0 0 24px" }}>⚙️ ตั้งค่าร้าน</h2>

      {/* เปิด/ปิดร้าน */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 20 }}>
        <h3 style={{ color: NAVY, margin: "0 0 8px" }}>เปิด/ปิดรับออเดอร์</h3>
        <p style={{ color: GRAY, fontSize: 13, margin: "0 0 16px" }}>
          ปิดรับออเดอร์ชั่วคราว (override เวลาทำการปกติ) เช่น วันหยุดพิเศษ หรือของหมด
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            onClick={() => save({ forceClose: !setting.forceClose })}
            style={{
              width: 56, height: 28, borderRadius: 14, cursor: "pointer", position: "relative",
              background: setting.forceClose ? "#EF4444" : "#22C55E",
              transition: "background 0.2s",
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: setting.forceClose ? 3 : 31,
              width: 22, height: 22, borderRadius: "50%", background: WHITE,
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: setting.forceClose ? "#EF4444" : "#22C55E" }}>
            {setting.forceClose ? "🔴 ปิดรับออเดอร์อยู่" : "🟢 เปิดรับออเดอร์"}
          </span>
        </div>
      </div>

      {/* ข้อความแจ้งเตือนใกล้ปิด */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 20 }}>
        <h3 style={{ color: NAVY, margin: "0 0 8px" }}>ข้อความแจ้งเตือนใกล้ปิด</h3>
        <p style={{ color: GRAY, fontSize: 13, margin: "0 0 16px" }}>
          แสดงให้ลูกค้าเห็นก่อนปิดรับออเดอร์ตามเวลาที่กำหนด
        </p>

        <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 6 }}>เริ่มแสดงตั้งแต่เวลา</label>
        <input
          type="time"
          value={setting.warningStart}
          onChange={e => setSetting(s => ({ ...s, warningStart: e.target.value }))}
          style={{ ...inp, width: 140, marginBottom: 16 }}
        />

        <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 6 }}>ข้อความแจ้งเตือน</label>
        <textarea
          value={setting.warningMessage}
          onChange={e => setSetting(s => ({ ...s, warningMessage: e.target.value }))}
          rows={3}
          style={{ ...inp, resize: "vertical" }}
        />

        <button
          onClick={() => save({ warningStart: setting.warningStart, warningMessage: setting.warningMessage })}
          disabled={saving}
          style={{ marginTop: 16, background: NAVY, color: WHITE, border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          {saved ? "✅ บันทึกแล้ว" : saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {/* Preview */}
      <div style={{ background: "#FFF7ED", border: "1.5px solid #FDBA74", borderRadius: 12, padding: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#92400E", fontWeight: 600 }}>👁 ตัวอย่างที่ลูกค้าเห็น:</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#92400E" }}>{setting.warningMessage}</p>
      </div>
    </div>
  );
}
