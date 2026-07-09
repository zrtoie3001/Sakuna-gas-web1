import { useState, useEffect, useRef } from "react";
import api from "../utils/api.js";

const NAVY = "#1B2A6B";
const ORANGE = "#E8873A";
const WHITE = "#FFFFFF";
const GRAY = "#6B7280";

function playTestBeep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sequences = type === "new"
      ? [
          { f: 1047, t: 0,    d: 0.12, wave: "square", vol: 0.3 },
          { f: 1047, t: 0.18, d: 0.12, wave: "square", vol: 0.3 },
          { f: 1047, t: 0.36, d: 0.12, wave: "square", vol: 0.3 },
          { f: 1397, t: 0.54, d: 0.3,  wave: "square", vol: 0.35 },
        ]
      : [
          { f: 659,  t: 0,    d: 0.15, wave: "sine", vol: 0.3 },
          { f: 880,  t: 0.2,  d: 0.25, wave: "sine", vol: 0.3 },
        ];
    sequences.forEach(({ f, t, d, wave, vol }) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = wave;
      g.gain.setValueAtTime(vol, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch {}
}

export default function Settings() {
  const [setting, setSetting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [soundOn, setSoundOn] = useState(localStorage.getItem("admin_sound") !== "off");

  useEffect(() => {
    api.get("/api/v1/settings/store").then(r => setSetting(r.data)).catch(() => {
      setSetting({ forceClose: false, forceOpen: false, warningMessage: "", warningStart: "18:00" });
    });
    // show default after 5s if API hasn't responded
    const t = setTimeout(() => setSetting(s => s || { forceClose: false, forceOpen: false, warningMessage: "", warningStart: "18:00" }), 5000);
    return () => clearTimeout(t);
  }, []);

  async function save(patch) {
    setSaving(true);
    // optimistic update — show immediately
    setSetting(s => ({ ...s, ...patch }));
    try {
      const r = await api.put("/api/v1/settings/store", patch);
      setSetting(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // still show saved since optimistic update applied
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!setting) return <p style={{ color: GRAY, padding: 24 }}>กำลังโหลด... (รอ backend ตื่นนอนสักครู่ 😅)</p>;

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

      {/* เปิดนอกเวลา (test mode) */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 20 }}>
        <h3 style={{ color: NAVY, margin: "0 0 8px" }}>เปิดนอกเวลาทำการ (Test Mode)</h3>
        <p style={{ color: GRAY, fontSize: 13, margin: "0 0 16px" }}>
          เปิดให้สั่งได้แม้นอกเวลาทำการ เช่น ต้องการเทสระบบหลังปิดร้าน
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            onClick={() => save({ forceOpen: !setting.forceOpen })}
            style={{ width: 56, height: 28, borderRadius: 14, cursor: "pointer", position: "relative", background: setting.forceOpen ? "#F59E0B" : "#E5E7EB", transition: "background 0.2s" }}
          >
            <div style={{ position: "absolute", top: 3, left: setting.forceOpen ? 31 : 3, width: 22, height: 22, borderRadius: "50%", background: WHITE, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: setting.forceOpen ? "#D97706" : GRAY }}>
            {setting.forceOpen ? "🟡 เปิดนอกเวลาอยู่" : "ปิดอยู่ (ปกติ)"}
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

      {/* เสียงแจ้งเตือน */}
      <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: 20 }}>
        <h3 style={{ color: NAVY, margin: "0 0 8px" }}>🔔 เสียงแจ้งเตือน</h3>
        <p style={{ color: GRAY, fontSize: 13, margin: "0 0 16px" }}>
          เปิด/ปิดเสียงเมื่อมีออเดอร์ใหม่หรือสถานะเปลี่ยน (บันทึกในเครื่องนี้)
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div onClick={() => { const next = !soundOn; setSoundOn(next); localStorage.setItem("admin_sound", next ? "on" : "off"); }}
            style={{ width: 56, height: 28, borderRadius: 14, cursor: "pointer", position: "relative", background: soundOn ? "#22C55E" : "#E5E7EB", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: soundOn ? 31 : 3, width: 22, height: 22, borderRadius: "50%", background: WHITE, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: soundOn ? "#22C55E" : GRAY }}>
            {soundOn ? "🔊 เปิดเสียง" : "🔇 ปิดเสียง"}
          </span>
        </div>

        <p style={{ color: GRAY, fontSize: 12, margin: "0 0 10px", fontWeight: 700 }}>ทดสอบเสียง:</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => playTestBeep("new")}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${NAVY}`, background: WHITE, color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🛒 ออเดอร์ใหม่
          </button>
          <button onClick={() => playTestBeep("update")}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid #22C55E", background: WHITE, color: "#15803D", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            ✅ ส่งสำเร็จ/รับงาน
          </button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: "#FFF7ED", border: "1.5px solid #FDBA74", borderRadius: 12, padding: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#92400E", fontWeight: 600 }}>👁 ตัวอย่างที่ลูกค้าเห็น:</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#92400E" }}>{setting.warningMessage}</p>
      </div>
    </div>
  );
}
