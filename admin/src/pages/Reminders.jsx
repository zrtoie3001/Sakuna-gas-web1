import { useState, useEffect } from "react";

const NAVY  = "#1A2B6B";
const ORANGE = "#F47B20";
const GRAY  = "#6B7280";
const WHITE = "#FFFFFF";

const DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

function loadReminders() {
  try { return JSON.parse(localStorage.getItem("reminders") || "[]"); } catch { return []; }
}
function saveReminders(list) {
  localStorage.setItem("reminders", JSON.stringify(list));
}

export default function Reminders() {
  const [reminders, setReminders] = useState(loadReminders);
  const [form, setForm] = useState({ name: "", note: "", time: "08:00", days: [1,2,3,4,5,6] });
  const [editing, setEditing] = useState(null);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => {
    if (Notification.permission === "denied") setPermDenied(true);
    else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => { if (p === "denied") setPermDenied(true); });
    }
  }, []);

  function persist(list) {
    setReminders(list);
    saveReminders(list);
  }

  function toggleDay(d) {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort(),
    }));
  }

  function submit() {
    if (!form.name.trim()) return alert("กรุณาใส่ชื่อลูกค้า");
    if (!form.days.length) return alert("กรุณาเลือกอย่างน้อย 1 วัน");
    if (editing !== null) {
      persist(reminders.map((r, i) => i === editing ? { ...form, id: r.id } : r));
      setEditing(null);
    } else {
      persist([...reminders, { ...form, id: Date.now() }]);
    }
    setForm({ name: "", note: "", time: "08:00", days: [1,2,3,4,5,6] });
  }

  function startEdit(i) {
    setEditing(i);
    setForm({ ...reminders[i] });
  }

  function remove(i) {
    if (!confirm("ลบแจ้งเตือนนี้?")) return;
    persist(reminders.filter((_, j) => j !== i));
    if (editing === i) { setEditing(null); setForm({ name: "", note: "", time: "08:00", days: [1,2,3,4,5,6] }); }
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ name: "", note: "", time: "08:00", days: [1,2,3,4,5,6] });
  }

  function testNotify(r) {
    if (Notification.permission !== "granted") {
      Notification.requestPermission().then(p => { if (p === "granted") fireTest(r); });
    } else fireTest(r);
  }
  function fireTest(r) {
    new Notification("🔔 แจ้งเตือนส่งแก๊ส — ทดสอบ", {
      body: `${r.name}${r.note ? " · " + r.note : ""}`,
      icon: "/favicon.ico",
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 700 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>🔔 แจ้งเตือนลูกค้าประจำ</h1>

      {permDenied && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#B91C1C" }}>
          ⚠️ เบราว์เซอร์บล็อกการแจ้งเตือน — กรุณาอนุญาตใน Settings ของเบราว์เซอร์
        </div>
      )}

      {/* Form */}
      <div style={{ background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", borderLeft: `4px solid ${ORANGE}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 14 }}>
          {editing !== null ? "✏️ แก้ไขแจ้งเตือน" : "➕ เพิ่มแจ้งเตือน"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>ชื่อลูกค้า *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="เช่น ร้านส้มตำนางแดง"
              style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>เวลาแจ้งเตือน *</label>
            <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>หมายเหตุ (ถ้ามี)</label>
          <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="เช่น 2 ถัง 15 กก."
            style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: GRAY, fontWeight: 700, display: "block", marginBottom: 8 }}>วันที่ส่ง</label>
          <div style={{ display: "flex", gap: 6 }}>
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  borderColor: form.days.includes(i) ? NAVY : "#E5E7EB",
                  background: form.days.includes(i) ? NAVY : WHITE,
                  color: form.days.includes(i) ? WHITE : GRAY }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            {editing !== null ? "💾 บันทึก" : "✅ เพิ่มแจ้งเตือน"}
          </button>
          {editing !== null && (
            <button onClick={cancelEdit}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ยกเลิก
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reminders.length === 0 && (
          <div style={{ textAlign: "center", color: GRAY, padding: 40, fontSize: 14 }}>ยังไม่มีแจ้งเตือน</div>
        )}
        {reminders.map((r, i) => (
          <div key={r.id} style={{ background: WHITE, borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 8px rgba(0,0,0,.05)",
            borderLeft: `4px solid ${editing === i ? ORANGE : "#10B981"}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 28 }}>🔔</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>{r.name}</div>
              {r.note && <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{r.note}</div>}
              <div style={{ fontSize: 12, color: GRAY, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>⏰ {r.time} น.</span>
                <span>·</span>
                <span>{r.days.map(d => DAY_FULL[d]).join(", ")}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => testNotify(r)} title="ทดสอบแจ้งเตือน"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, fontSize: 13, cursor: "pointer" }}>
                🔔
              </button>
              <button onClick={() => startEdit(i)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, fontSize: 13, cursor: "pointer" }}>
                ✏️
              </button>
              <button onClick={() => remove(i)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", fontSize: 13, cursor: "pointer", color: "#B91C1C" }}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
