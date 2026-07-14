import { useState, useEffect } from "react";
import api from "../utils/api.js";

const NAVY  = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const TYPE_LABEL = { money: "💰 ค้างเงิน", tank: "🛢 ค้างถัง", both: "💰🛢 ค้างทั้งคู่" };
const EMPTY_FORM = { customerName: "", customerPhone: "", type: "money", amount: "", tankQty: "", tankDesc: "", note: "" };

function StatusBadge({ isPaid, tankReturned, type }) {
  const moneyDone = type === "tank" || isPaid;
  const tankDone  = type === "money" || tankReturned;
  if (moneyDone && tankDone) return <span style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✅ เคลียร์แล้ว</span>;
  const parts = [];
  if (!moneyDone) parts.push("ยังค้างเงิน");
  if (!tankDone)  parts.push("ยังค้างถัง");
  return <span style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>⚠️ {parts.join(" · ")}</span>;
}

export default function Debts() {
  const [debts, setDebts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [filter, setFilter]   = useState("unpaid"); // unpaid | all
  const [search, setSearch]   = useState("");
  const [editId, setEditId]   = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "unpaid") params.set("unpaid", "1");
      if (search) params.set("search", search);
      const r = await api.get(`/api/v1/debts?${params}`);
      setDebts(r.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter, search]);

  async function save() {
    if (!form.customerName) return alert("กรุณาใส่ชื่อลูกค้า");
    if (form.type !== "tank" && !form.amount) return alert("กรุณาใส่ยอดเงิน");
    if (form.type !== "money" && !form.tankQty) return alert("กรุณาใส่จำนวนถัง");
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/api/v1/debts/${editId}`, form);
      } else {
        await api.post("/api/v1/debts", form);
      }
      setShowForm(false); setForm(EMPTY_FORM); setEditId(null);
      load();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function markPaid(debt) {
    const patch = {};
    if ((debt.type === "money" || debt.type === "both") && !debt.isPaid) patch.isPaid = true;
    if ((debt.type === "tank"  || debt.type === "both") && !debt.tankReturned) patch.tankReturned = true;
    await api.put(`/api/v1/debts/${debt.id}`, patch);
    load();
  }

  async function markMoneyPaid(debt) {
    await api.put(`/api/v1/debts/${debt.id}`, { isPaid: true });
    load();
  }

  async function markTankReturned(debt) {
    await api.put(`/api/v1/debts/${debt.id}`, { tankReturned: true });
    load();
  }

  async function del(id) {
    if (!confirm("ลบรายการนี้?")) return;
    await api.delete(`/api/v1/debts/${id}`);
    load();
  }

  function openEdit(debt) {
    setForm({
      customerName: debt.customerName,
      customerPhone: debt.customerPhone || "",
      type: debt.type,
      amount: debt.amount || "",
      tankQty: debt.tankQty || "",
      tankDesc: debt.tankDesc || "",
      note: debt.note || "",
    });
    setEditId(debt.id);
    setShowForm(true);
  }

  const inp = { border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "9px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const unpaidCount = debts.filter(d => {
    const moneyDone = d.type === "tank" || d.isPaid;
    const tankDone  = d.type === "money" || d.tankReturned;
    return !moneyDone || !tankDone;
  }).length;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ color: NAVY, margin: 0 }}>💸 ค้างเงิน / ค้างถัง</h2>
          {filter === "unpaid" && unpaidCount > 0 && (
            <p style={{ color: "#DC2626", margin: "4px 0 0", fontSize: 13, fontWeight: 700 }}>ยังค้างอยู่ {unpaidCount} รายการ</p>
          )}
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEditId(null); }}
          style={{ background: NAVY, color: WHITE, border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + เพิ่มรายการค้าง
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[["unpaid","⚠️ ยังค้างอยู่"], ["all","ทั้งหมด"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: "7px 16px", borderRadius: 20, border: `2px solid ${filter === k ? NAVY : "#E5E7EB"}`, background: filter === k ? NAVY : WHITE, color: filter === k ? WHITE : GRAY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <input placeholder="🔍 ค้นหาชื่อ/เบอร์..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, width: 200, padding: "7px 12px" }} />
      </div>

      {/* List */}
      {loading ? <p style={{ color: GRAY }}>กำลังโหลด...</p> : debts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: GRAY }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <p style={{ fontWeight: 700 }}>{filter === "unpaid" ? "ไม่มีรายการค้างอยู่" : "ยังไม่มีรายการ"}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {debts.map(d => {
            const moneyDone = d.type === "tank" || d.isPaid;
            const tankDone  = d.type === "money" || d.tankReturned;
            const allDone   = moneyDone && tankDone;
            return (
              <div key={d.id} style={{ background: WHITE, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)", borderLeft: `4px solid ${allDone ? "#22C55E" : "#EF4444"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>{d.customerName}</div>
                    {d.customerPhone && <div style={{ fontSize: 13, color: GRAY }}>📞 {d.customerPhone}</div>}
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
                      {new Date(d.createdAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                      &nbsp;·&nbsp;{TYPE_LABEL[d.type]}
                    </div>
                  </div>
                  <StatusBadge isPaid={d.isPaid} tankReturned={d.tankReturned} type={d.type} />
                </div>

                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  {(d.type === "money" || d.type === "both") && (
                    <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "6px 12px" }}>
                      <span style={{ fontSize: 12, color: "#92400E" }}>ค้างเงิน</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: "#92400E" }}>฿{Number(d.amount).toLocaleString()}</div>
                      {d.isPaid && <div style={{ fontSize: 11, color: "#065F46" }}>✅ จ่ายแล้ว {d.paidAt ? new Date(d.paidAt).toLocaleDateString("th-TH") : ""}</div>}
                    </div>
                  )}
                  {(d.type === "tank" || d.type === "both") && (
                    <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "6px 12px" }}>
                      <span style={{ fontSize: 12, color: "#1E40AF" }}>ค้างถัง</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: "#1E40AF" }}>{d.tankQty} ใบ {d.tankDesc ? `(${d.tankDesc})` : ""}</div>
                      {d.tankReturned && <div style={{ fontSize: 11, color: "#065F46" }}>✅ คืนแล้ว {d.tankReturnedAt ? new Date(d.tankReturnedAt).toLocaleDateString("th-TH") : ""}</div>}
                    </div>
                  )}
                </div>

                {d.note && <div style={{ marginTop: 8, fontSize: 12, color: GRAY, fontStyle: "italic" }}>หมายเหตุ: {d.note}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {!moneyDone && (d.type === "money" || d.type === "both") && (
                    <button onClick={() => markMoneyPaid(d)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#22C55E", color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      ✅ รับเงินแล้ว
                    </button>
                  )}
                  {!tankDone && (d.type === "tank" || d.type === "both") && (
                    <button onClick={() => markTankReturned(d)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#3B82F6", color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      🛢 รับถังคืนแล้ว
                    </button>
                  )}
                  <button onClick={() => openEdit(d)} style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid #E5E7EB`, background: WHITE, color: GRAY, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    ✏️ แก้ไข
                  </button>
                  <button onClick={() => del(d.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ color: NAVY, margin: 0 }}>{editId ? "แก้ไขรายการค้าง" : "เพิ่มรายการค้าง"}</h3>
              <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {[["ชื่อลูกค้า *", "customerName", "text"], ["เบอร์โทร", "customerPhone", "tel"]].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ประเภทค้าง *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                <option value="money">💰 ค้างเงิน</option>
                <option value="tank">🛢 ค้างถัง</option>
                <option value="both">💰🛢 ค้างทั้งเงินและถัง</option>
              </select>
            </div>

            {(form.type === "money" || form.type === "both") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>ยอดเงินค้าง (บาท) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inp} placeholder="0" />
              </div>
            )}

            {(form.type === "tank" || form.type === "both") && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>จำนวนถังค้าง *</label>
                  <input type="number" value={form.tankQty} onChange={e => setForm(f => ({ ...f, tankQty: e.target.value }))} style={inp} placeholder="0" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>รายละเอียดถัง (เช่น ปตท 15กก.)</label>
                  <input type="text" value={form.tankDesc} onChange={e => setForm(f => ({ ...f, tankDesc: e.target.value }))} style={inp} />
                </div>
              </>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: GRAY, display: "block", marginBottom: 4, fontWeight: 700 }}>หมายเหตุ</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>

            <button onClick={save} disabled={saving} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "บันทึก"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
