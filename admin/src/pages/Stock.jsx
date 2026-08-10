import { useState, useEffect, useCallback } from "react";
import api from "../utils/api.js";

const NAVY = "#1B2A6B";
const ORANGE = "#E8873A";
const WHITE = "#FFFFFF";
const GRAY = "#6B7280";
const LIGHT = "#F8F9FF";

const BRANDS = ["ปตท", "PAP", "เวิลด์", "สยาม", "ยูนิค"];
const WEIGHTS = [4, 7, 8, 11.5, 13.5, 15, 48];
const FIELDS = [
  { key: "hasGas",      label: "มีแก๊ส",    color: "#22C55E" },
  { key: "newTank",     label: "ถังใหม่",   color: "#3B82F6" },
  { key: "emptyTank",   label: "เปล่า",     color: "#F59E0B" },
  { key: "damagedTank", label: "เสีย",      color: "#EF4444" },
  { key: "heldTank",    label: "ค้างถัง",  color: "#8B5CF6" },
];

const FIELD_LABEL = { hasGas: "ถังมีแก๊ส", newTank: "ถังใหม่", emptyTank: "ถังเปล่า", damagedTank: "ถังเสีย", heldTank: "ค้างถัง" };
const ACTION_LABEL = { refill: "เติมแก๊ส", adjust: "ปรับสต็อก", manual: "แก้ไขด้วยตัวเอง" };

export default function Stock() {
  const [tab, setTab] = useState("gas"); // gas | refill | equipment | history
  const [stock, setStock] = useState([]);
  const [refills, setRefills] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [logs, setLogs] = useState([]);

  // modals
  const [editCell, setEditCell] = useState(null); // { brandName, weightKg, row }
  const [showRefill, setShowRefill] = useState(false);
  const [refillForm, setRefillForm] = useState({ brandName: BRANDS[0], weightKg: 15, qty: 1, costPerUnit: "", note: "" });
  const [equipCategory, setEquipCategory] = useState("equipment"); // equipment | stove
  const [equipSearch, setEquipSearch] = useState("");
  const [showEquipForm, setShowEquipForm] = useState(false);
  const [equipForm, setEquipForm] = useState({ name: "", price: "", qty: "", description: "", category: "equipment" });
  const [editEquip, setEditEquip] = useState(null);
  const [showSell, setShowSell] = useState(null);
  const [sellForm, setSellForm] = useState({ qty: 1, salePrice: "", note: "" });

  const fetchStock = useCallback(() => {
    api.get("/api/v1/stock/gas").then(r => setStock(r.data)).catch(() => {});
  }, []);
  const fetchRefills = useCallback(() => {
    api.get("/api/v1/stock/refills").then(r => setRefills(r.data)).catch(() => {});
  }, []);
  const fetchEquipment = useCallback(() => {
    api.get("/api/v1/stock/equipment").then(r => setEquipment(r.data)).catch(() => {});
  }, []);

  const fetchLogs = useCallback(() => {
    api.get("/api/v1/stock/gas/logs?limit=200").then(r => setLogs(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchStock(); fetchRefills(); fetchEquipment(); fetchLogs(); }, [fetchStock, fetchRefills, fetchEquipment, fetchLogs]);

  function getCell(brand, weight) {
    return stock.find(s => s.brandName === brand && Number(s.weightKg) === weight) || {
      brandName: brand, weightKg: weight, hasGas: 0, newTank: 0, emptyTank: 0, damagedTank: 0, heldTank: 0
    };
  }

  function totalRow(row) {
    return FIELDS.reduce((s, f) => s + Number(row[f.key] || 0), 0);
  }

  async function saveEdit() {
    const { brandName, weightKg, hasGas = 0, newTank = 0, emptyTank = 0, damagedTank = 0, heldTank = 0 } = editCell;
    await api.post("/api/v1/stock/gas", { brandName, weightKg, hasGas, newTank, emptyTank, damagedTank, heldTank });
    setEditCell(null);
    fetchStock();
    fetchLogs();
  }

  async function adjust(brand, weight, field, delta) {
    await api.post("/api/v1/stock/gas/adjust", { brandName: brand, weightKg: weight, field, delta });
    fetchStock();
  }

  async function submitRefill() {
    await api.post("/api/v1/stock/refills", refillForm);
    setShowRefill(false);
    setRefillForm({ brandName: BRANDS[0], weightKg: 15, qty: 1, costPerUnit: "", note: "" });
    fetchStock(); fetchRefills();
  }

  async function submitEquip() {
    if (editEquip) {
      await api.put(`/api/v1/stock/equipment/${editEquip.id}`, equipForm);
    } else {
      await api.post("/api/v1/stock/equipment", { ...equipForm, category: equipCategory });
    }
    setShowEquipForm(false); setEditEquip(null);
    setEquipForm({ name: "", price: "", qty: "", description: "", category: "equipment" });
    fetchEquipment();
  }

  async function deleteEquip(id) {
    if (!confirm("ลบรายการนี้?")) return;
    await api.delete(`/api/v1/stock/equipment/${id}`);
    fetchEquipment();
  }

  async function submitSell() {
    await api.post(`/api/v1/stock/equipment/${showSell.id}/sell`, sellForm);
    setShowSell(null); setSellForm({ qty: 1, salePrice: "", note: "" });
    fetchEquipment();
  }

  const inp = { border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", width: "100%", fontSize: 14, boxSizing: "border-box" };
  const btn = (bg, color = WHITE) => ({ background: bg, color, border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 });

  // ── Totals per brand ──────────────────────────────────────────────────────────
  function brandTotal(brand) {
    const rows = WEIGHTS.map(w => getCell(brand, w));
    return FIELDS.reduce((acc, f) => { acc[f.key] = rows.reduce((s, r) => s + Number(r[f.key] || 0), 0); return acc; }, {});
  }
  function grandTotal() {
    return FIELDS.reduce((acc, f) => {
      acc[f.key] = stock.reduce((s, r) => s + Number(r[f.key] || 0), 0);
      return acc;
    }, {});
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ color: NAVY, margin: "0 0 16px" }}>📦 สต็อกสินค้า</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["gas","⛽ สต็อกถัง"],["refill","🔄 บันทึกเติมแก๊ส"],["equipment","🔧 อุปกรณ์"],["history","📋 ประวัติการเปลี่ยนแปลง"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...btn(tab === key ? NAVY : "#E5E7EB", tab === key ? WHITE : NAVY),
            padding: "8px 20px",
          }}>{label}</button>
        ))}
      </div>

      {/* ── GAS STOCK ── */}
      {tab === "gas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
            <button onClick={async () => {
              if (!confirm("รีเซ็ตสต็อกทั้งหมดเป็น 0?")) return;
              await Promise.all(BRANDS.flatMap(b => WEIGHTS.map(w =>
                api.post("/api/v1/stock/gas", { brandName: b, weightKg: w, hasGas: 0, newTank: 0, emptyTank: 0, damagedTank: 0, heldTank: 0 })
              )));
              fetchStock();
            }} style={btn("#EF4444")}>🔄 รีเซ็ตทั้งหมด</button>
            <button onClick={() => setShowRefill(true)} style={btn(ORANGE)}>+ บันทึกรับแก๊ส</button>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {FIELDS.map(f => (
              <span key={f.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: f.color, display: "inline-block" }} />
                {f.label}
              </span>
            ))}
          </div>

          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: NAVY, color: WHITE }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", position: "sticky", top: 0, zIndex: 10, background: NAVY }}>ยี่ห้อ</th>
                  <th style={{ padding: "8px 12px", position: "sticky", top: 0, zIndex: 10, background: NAVY }}>น้ำหนัก</th>
                  {FIELDS.map(f => <th key={f.key} style={{ padding: "8px 8px", color: f.color, position: "sticky", top: 0, zIndex: 10, background: NAVY }}>{f.label}</th>)}
                  <th style={{ padding: "8px 8px", position: "sticky", top: 0, zIndex: 10, background: NAVY }}>รวม</th>
                  <th style={{ padding: "8px 8px", position: "sticky", top: 0, zIndex: 10, background: NAVY }}>แก้ไข</th>
                </tr>
              </thead>
              <tbody>
                {BRANDS.map((brand, bi) => (
                  <>
                    {WEIGHTS.map((w, wi) => {
                      const row = getCell(brand, w);
                      const total = totalRow(row);
                      return (
                        <tr key={`${brand}-${w}`} style={{ background: (bi + wi) % 2 === 0 ? WHITE : LIGHT }}>
                          {wi === 0 && <td rowSpan={WEIGHTS.length} style={{ padding: "8px 12px", fontWeight: 700, color: NAVY, verticalAlign: "middle", borderRight: "2px solid #E5E7EB" }}>{brand}</td>}
                          <td style={{ padding: "6px 8px", textAlign: "center", color: GRAY }}>{w} kg</td>
                          {FIELDS.map(f => (
                            <td key={f.key} style={{ padding: "4px 6px", textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                                <button onClick={() => adjust(brand, w, f.key, -1)} style={{ width: 22, height: 22, borderRadius: 4, border: "none", background: "#EF4444", color: WHITE, cursor: "pointer", fontSize: 13, lineHeight: 1, flexShrink: 0 }}>−</button>
                                <input
                                  type="number" min="0"
                                  defaultValue={row[f.key] || 0}
                                  key={`${brand}-${w}-${f.key}-${row[f.key] || 0}`}
                                  onBlur={async e => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    const old = Number(row[f.key] || 0);
                                    if (val === old) return;
                                    await api.post("/api/v1/stock/gas", { brandName: brand, weightKg: w, ...getCell(brand, w), [f.key]: val });
                                    fetchStock();
                                  }}
                                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                                  style={{ width: 40, textAlign: "center", fontWeight: 700, color: Number(row[f.key]) > 0 ? f.color : GRAY, border: "1px solid #E5E7EB", borderRadius: 4, padding: "2px 4px", fontSize: 13 }}
                                />
                                <button onClick={() => adjust(brand, w, f.key, 1)} style={{ width: 22, height: 22, borderRadius: 4, border: "none", background: "#22C55E", color: WHITE, cursor: "pointer", fontSize: 13, lineHeight: 1, flexShrink: 0 }}>+</button>
                              </div>
                            </td>
                          ))}
                          <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>{total}</td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>
                            <button onClick={() => setEditCell({ ...row })} style={btn("#E5E7EB", NAVY)}>✏️</button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* brand subtotal */}
                    <tr style={{ background: "#EEF2FF", borderTop: "2px solid " + NAVY }}>
                      <td colSpan={2} style={{ padding: "6px 12px", fontWeight: 700, color: NAVY }}>รวม {brand}</td>
                      {FIELDS.map(f => { const bt = brandTotal(brand); return <td key={f.key} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: f.color }}>{bt[f.key]}</td>; })}
                      <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>{Object.values(brandTotal(brand)).reduce((a,b) => a+b, 0)}</td>
                      <td />
                    </tr>
                  </>
                ))}
                {/* Grand total */}
                <tr style={{ background: NAVY, color: WHITE }}>
                  <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700 }}>รวมทั้งหมด</td>
                  {FIELDS.map(f => { const gt = grandTotal(); return <td key={f.key} style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700 }}>{gt[f.key]}</td>; })}
                  <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700 }}>{FIELDS.reduce((s,f) => s + (grandTotal()[f.key]||0), 0)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REFILL LOG ── */}
      {tab === "refill" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setShowRefill(true)} style={btn(ORANGE)}>+ บันทึกเติมแก๊ส</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: NAVY, color: WHITE }}>
                  {["วันที่","ยี่ห้อ","น้ำหนัก","จำนวน","ราคา/ถัง","รวม","หมายเหตุ"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refills.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? WHITE : LIGHT }}>
                    <td style={{ padding: "8px 12px" }}>{new Date(r.createdAt).toLocaleDateString("th-TH")}</td>
                    <td style={{ padding: "8px 12px" }}>{r.brandName}</td>
                    <td style={{ padding: "8px 12px" }}>{r.weightKg} kg</td>
                    <td style={{ padding: "8px 12px" }}>{r.qty} ถัง</td>
                    <td style={{ padding: "8px 12px" }}>฿{Number(r.costPerUnit||0).toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>฿{Number(r.totalCost||0).toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", color: GRAY }}>{r.note || "-"}</td>
                  </tr>
                ))}
                {refills.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: GRAY }}>ยังไม่มีบันทึก</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EQUIPMENT ── */}
      {tab === "equipment" && (
        <div>
          {/* Sub-category + search + add button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[["equipment","🔧 อะไหล่/อุปกรณ์"],["stove","🍳 เตา"]].map(([k, label]) => (
                <button key={k} onClick={() => setEquipCategory(k)} style={{
                  ...btn(equipCategory === k ? NAVY : "#E5E7EB", equipCategory === k ? WHITE : NAVY),
                  padding: "8px 16px",
                }}>{label}</button>
              ))}
            </div>
            <input
              placeholder="🔍 ค้นหาสินค้า..."
              value={equipSearch}
              onChange={e => setEquipSearch(e.target.value)}
              style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 13, flex: 1, minWidth: 160 }}
            />
            <button onClick={() => {
              setEditEquip(null);
              setEquipForm({ name: "", price: "", qty: "", description: "", category: equipCategory });
              setShowEquipForm(true);
            }} style={btn(ORANGE)}>+ เพิ่ม{equipCategory === "stove" ? "เตา" : "อุปกรณ์"}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {equipment
              .filter(item => item.category === equipCategory || (!item.category && equipCategory === "equipment"))
              .filter(item => !equipSearch || item.name.toLowerCase().includes(equipSearch.toLowerCase()) || (item.description || "").toLowerCase().includes(equipSearch.toLowerCase()))
              .map(item => (
                <div key={item.id} style={{ background: WHITE, borderRadius: 12, border: "1.5px solid #E5E7EB", padding: 16 }}>
                  <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ color: ORANGE, fontWeight: 700, fontSize: 18 }}>฿{Number(item.price).toLocaleString()}</div>
                  <div style={{ color: GRAY, fontSize: 12, margin: "4px 0" }}>{item.description}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontWeight: 600, color: item.qty > 0 ? "#22C55E" : "#EF4444" }}>คงเหลือ: {item.qty}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => { setShowSell(item); setSellForm({ qty: 1, salePrice: item.price, note: "" }); }} style={{ ...btn("#22C55E"), flex: 1, fontSize: 12 }}>ขาย</button>
                    <button onClick={() => { setEditEquip(item); setEquipForm({ name: item.name, price: item.price, qty: item.qty, description: item.description || "", category: item.category || "equipment" }); setShowEquipForm(true); }} style={{ ...btn("#E5E7EB", NAVY), fontSize: 12 }}>✏️</button>
                    <button onClick={() => deleteEquip(item.id)} style={{ ...btn("#EF4444"), fontSize: 12 }}>🗑</button>
                  </div>
                </div>
              ))}
            {equipment.filter(item => item.category === equipCategory || (!item.category && equipCategory === "equipment")).length === 0 && (
              <p style={{ color: GRAY }}>ยังไม่มี{equipCategory === "stove" ? "เตา" : "อุปกรณ์"}</p>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: NAVY, color: WHITE }}>
                  {["วันที่/เวลา","ยี่ห้อ","น้ำหนัก","ประเภทถัง","ก่อน","หลัง","เปลี่ยน","การกระทำ","หมายเหตุ"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? WHITE : LIGHT }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: GRAY }}>
                      {new Date(r.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.brandName}</td>
                    <td style={{ padding: "8px 12px" }}>{r.weightKg} kg</td>
                    <td style={{ padding: "8px 12px" }}>{FIELD_LABEL[r.field] || r.field}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{r.oldValue}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>{r.newValue}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: r.delta > 0 ? "#22C55E" : "#EF4444" }}>
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </td>
                    <td style={{ padding: "8px 12px" }}>{ACTION_LABEL[r.action] || r.action}</td>
                    <td style={{ padding: "8px 12px", color: GRAY }}>{r.note || "-"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: GRAY }}>ยังไม่มีประวัติ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Stock Cell ── */}
      {editCell && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 340 }}>
            <h3 style={{ color: NAVY, margin: "0 0 16px" }}>แก้ไขสต็อก — {editCell.brandName} {editCell.weightKg} kg</h3>
            {FIELDS.map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type="number" min="0" value={editCell[f.key] || 0} onChange={e => setEditCell(c => ({ ...c, [f.key]: Number(e.target.value) }))} style={inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={saveEdit} style={{ ...btn(NAVY), flex: 1 }}>บันทึก</button>
              <button onClick={() => setEditCell(null)} style={{ ...btn("#E5E7EB", NAVY), flex: 1 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Refill ── */}
      {showRefill && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 360 }}>
            <h3 style={{ color: NAVY, margin: "0 0 16px" }}>🔄 บันทึกรับแก๊ส</h3>
            {[["brandName","ยี่ห้อ"],["weightKg","น้ำหนัก (kg)"],["qty","จำนวน (ถัง)"],["costPerUnit","ราคาต่อถัง (฿)"],["note","หมายเหตุ"]].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 4 }}>{label}</label>
                {key === "brandName" ? (
                  <select value={refillForm.brandName} onChange={e => setRefillForm(f => ({ ...f, brandName: e.target.value }))} style={inp}>
                    {BRANDS.map(b => <option key={b}>{b}</option>)}
                  </select>
                ) : key === "weightKg" ? (
                  <select value={refillForm.weightKg} onChange={e => setRefillForm(f => ({ ...f, weightKg: Number(e.target.value) }))} style={inp}>
                    {WEIGHTS.map(w => <option key={w} value={w}>{w} kg</option>)}
                  </select>
                ) : (
                  <input type={key === "note" ? "text" : "number"} min="0" value={refillForm[key]} onChange={e => setRefillForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={submitRefill} style={{ ...btn(NAVY), flex: 1 }}>บันทึก</button>
              <button onClick={() => setShowRefill(false)} style={{ ...btn("#E5E7EB", NAVY), flex: 1 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add/Edit Equipment ── */}
      {showEquipForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 360 }}>
            <h3 style={{ color: NAVY, margin: "0 0 16px" }}>{editEquip ? "แก้ไข" : "เพิ่ม"}{equipForm.category === "stove" ? "เตา" : "อุปกรณ์/อะไหล่"}</h3>
            {/* Category picker */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[["equipment","🔧 อะไหล่/อุปกรณ์"],["stove","🍳 เตา"]].map(([k, label]) => (
                <button key={k} onClick={() => setEquipForm(f => ({ ...f, category: k }))} style={{
                  ...btn(equipForm.category === k ? NAVY : "#E5E7EB", equipForm.category === k ? WHITE : NAVY),
                  flex: 1, fontSize: 12, padding: "7px 4px",
                }}>{label}</button>
              ))}
            </div>
            {[["name","ชื่อสินค้า"],["price","ราคา (฿)"],["qty","จำนวนคงเหลือ"],["description","คำอธิบาย"]].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 4 }}>{label}</label>
                <input type={["price","qty"].includes(key) ? "number" : "text"} value={equipForm[key]} onChange={e => setEquipForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={submitEquip} style={{ ...btn(NAVY), flex: 1 }}>บันทึก</button>
              <button onClick={() => { setShowEquipForm(false); setEditEquip(null); }} style={{ ...btn("#E5E7EB", NAVY), flex: 1 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Sell Equipment ── */}
      {showSell && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 340 }}>
            <h3 style={{ color: NAVY, margin: "0 0 16px" }}>ขาย — {showSell.name}</h3>
            <p style={{ color: GRAY, fontSize: 13 }}>คงเหลือ: {showSell.qty} ชิ้น</p>
            {[["qty","จำนวน"],["salePrice","ราคาขาย (฿)"],["note","หมายเหตุ"]].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: GRAY, display: "block", marginBottom: 4 }}>{label}</label>
                <input type={key === "note" ? "text" : "number"} min="0" value={sellForm[key]} onChange={e => setSellForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={submitSell} style={{ ...btn("#22C55E"), flex: 1 }}>ยืนยันขาย</button>
              <button onClick={() => setShowSell(null)} style={{ ...btn("#E5E7EB", NAVY), flex: 1 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
