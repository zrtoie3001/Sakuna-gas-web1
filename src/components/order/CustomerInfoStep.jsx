const NAVY = "#1A2B6B";
const GRAY = "#6B7280";

export default function CustomerInfoStep({ name, phone, note, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>📋 ข้อมูลผู้สั่ง</p>

      <div>
        <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>ชื่อผู้สั่ง *</label>
        <input
          value={name}
          onChange={e => onChange("name", e.target.value)}
          placeholder="ชื่อ-นามสกุล"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `2px solid ${name ? "#CBD5E1" : "#FCA5A5"}`,
            fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>เบอร์โทรศัพท์ *</label>
        <input
          value={phone}
          onChange={e => onChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="0812345678"
          inputMode="tel"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: `2px solid ${phone.length >= 9 ? "#CBD5E1" : "#FCA5A5"}`,
            fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: GRAY, display: "block", marginBottom: 4 }}>หมายเหตุ (ไม่บังคับ)</label>
        <textarea
          value={note}
          onChange={e => onChange("note", e.target.value)}
          placeholder="เช่น หน้าบ้านมีป้ายสีแดง, บ้านตรงหัวซอย"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: "2px solid #CBD5E1", fontSize: 13, resize: "none",
            boxSizing: "border-box", color: GRAY,
          }}
        />
      </div>
    </div>
  );
}
