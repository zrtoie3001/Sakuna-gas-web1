import { useState, useCallback } from "react";
import { BRANDS, PRODUCTS, ZONES, DISCOUNT_CODES, getDistanceKm, getZoneFromDist } from "./config.js";
import MapPicker from "./components/MapPicker.jsx";

// ── Design tokens ──────────────────────────────────────────────────────────
const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const ORANGE2= "#E55C00";
const WHITE  = "#FFFFFF";
const LGRAY  = "#F4F6FB";
const GRAY   = "#6B7280";

const STEPS = ["ยี่ห้อ", "สินค้า", "ที่อยู่", "ยืนยัน"];

// ── Logo SVG ────────────────────────────────────────────────────────────────
function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="48" fill={NAVY} stroke={ORANGE} strokeWidth="3"/>
      <path d="M62 30 C65 40 70 45 66 56 C63 63 55 67 55 67 C57 60 53 55 50 52 C50 58 46 63 44 67 C40 60 38 50 42 40 C45 33 52 28 62 30Z" fill={ORANGE}/>
      <path d="M50 52 C48 56 46 62 48 67 C45 63 43 57 44 52 C42 55 41 60 42 65 C39 58 38 50 42 40 C44 45 48 48 50 52Z" fill="#FFD166"/>
      <rect x="38" y="55" width="24" height="28" rx="5" fill="#2563EB"/>
      <rect x="38" y="55" width="24" height="8"  rx="3" fill="#1D4ED8"/>
      <rect x="46" y="50" width="8"  height="6"  rx="2" fill="#92400E"/>
      <rect x="44" y="48" width="12" height="3"  rx="1.5" fill="#B45309"/>
    </svg>
  );
}

// ── Step bar ─────────────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            {i > 0 && (
              <div style={{ flex: 1, height: 2,
                background: i <= step ? ORANGE : "rgba(255,255,255,.2)",
                transition: "background .4s" }}/>
            )}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: i < step ? ORANGE : i === step ? WHITE : "rgba(255,255,255,.2)",
              color:      i < step ? WHITE  : i === step ? NAVY  : "rgba(255,255,255,.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, transition: "all .3s",
              boxShadow: i === step ? "0 0 0 3px rgba(255,255,255,.3)" : "none",
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2,
                background: i < step ? ORANGE : "rgba(255,255,255,.2)",
                transition: "background .4s" }}/>
            )}
          </div>
          <div style={{
            fontSize: 8, marginTop: 3, textAlign: "center", lineHeight: 1.2,
            color:      i === step ? WHITE : "rgba(255,255,255,.4)",
            fontWeight: i === step ? 700 : 400,
          }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY,
        display: "flex", alignItems: "center", gap: 7 }}>
        <span>{icon}</span>{title}
      </h2>
      {sub && <p style={{ fontSize: 11, color: GRAY, marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// Brand image with fallback
function BrandImage({ brand, size = 56 }) {
  const [imgErr, setImgErr] = useState(false);

  if (brand.image && !imgErr) {
    return (
      <img
        src={brand.image}
        alt={brand.name}
        onError={() => setImgErr(true)}
        style={{
          width: size, height: size, objectFit: "contain",
          borderRadius: 10, background: brand.bgColor,
          padding: 4,
        }}
      />
    );
  }

  // Fallback: colored circle with initials
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${brand.color}, ${brand.color}BB)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 4px 12px ${brand.color}40`, flexShrink: 0,
    }}>
      <span style={{ color: WHITE, fontWeight: 900, fontSize: size * 0.28,
        fontFamily: "'Sarabun', sans-serif" }}>
        {brand.name.slice(0, 3)}
      </span>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]         = useState(0);
  const [brand, setBrand]       = useState(null);
  const [product, setProduct]   = useState(null);
  const [qty, setQty]           = useState(1);
  const [locData, setLocData]   = useState(null);
  const [note, setNote]         = useState("");
  const [done, setDone]         = useState(false);
  const [discountCode, setDiscountCode] = useState(() => localStorage.getItem("discountCode") || "");
  const [discountInput, setDiscountInput] = useState("");
  const [discountMsg, setDiscountMsg]     = useState(null);

  const prod      = PRODUCTS.find(p => p.id === product);
  const brandObj  = BRANDS.find(b => b.id === brand);
  const unitPrice = prod ? prod.homePrice : 0;
  const discountAmt = (product === "p15" && DISCOUNT_CODES[discountCode?.toLowerCase()]) || 0;
  const total = Math.max(0, unitPrice * qty - discountAmt);

  // ส่งผ่านไป MapPicker
  const handleLocationSelect = useCallback((data) => {
    setLocData(data);
  }, []);

  const canNext = [
    !!brand,
    !!product,
    !!(locData && locData.zone),
    true,
  ][step];

  const orderId = `SKG${Date.now().toString().slice(-6)}`;

  function handleNext() {
    if (step < 3) setStep(step + 1);
    else setDone(true);
  }

  function applyDiscount() {
    const key = discountInput.trim().toLowerCase();
    if (DISCOUNT_CODES[key]) {
      setDiscountCode(key);
      localStorage.setItem("discountCode", key);
      setDiscountMsg({ ok: true, text: `ใช้โค้ดได้! ลด ฿${DISCOUNT_CODES[key]}` });
    } else {
      setDiscountMsg({ ok: false, text: "โค้ดไม่ถูกต้อง" });
    }
  }

  function handleReset() {
    setDone(false); setStep(0); setBrand(null);
    setProduct(null); setQty(1); setLocData(null); setNote("");
  }

  if (done) {
    return (
      <DoneScreen
        orderId={orderId} prod={prod} qty={qty} brandObj={brandObj}
        locData={locData} total={total} note={note}
        onReset={handleReset}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: LGRAY }}>
      {/* ─── Header ─── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 100%)`,
        padding: "16px 20px 20px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(10,18,50,.35)",
        overflow: "hidden",
      }}>
        {/* flame bg deco */}
        <div style={{ position: "absolute", top: -8, right: -8, opacity: .06, pointerEvents: "none" }}>
          <svg width="140" height="140" viewBox="0 0 100 100">
            <path d="M62 10C70 30 80 45 70 65 62 78 48 85 48 85 54 68 44 55 36 42 36 58 28 70 24 85 8 65 4 45 18 25 30 8 50 3 62 10Z" fill="white"/>
          </svg>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Logo size={44}/>
            <div>
              <div style={{ color: WHITE, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
                สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
              </div>
              <div style={{ color: "rgba(255,255,255,.6)", fontSize: 10, marginTop: 2 }}>
                ปลอดภัย มั่นใจ ได้มาตรฐาน
              </div>
            </div>
            <div style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)",
              borderRadius: 20, padding: "4px 10px", fontSize: 10,
              color: "rgba(255,255,255,.85)", whiteSpace: "nowrap" }}>
              🕐 {new Date().getDay() === 0 ? "07:00–13:00" : "07:00–19:00"}
            </div>
          </div>
          <StepBar step={step}/>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "18px 16px 120px", maxWidth: 460, margin: "0 auto" }}>

        {/* STEP 0 — ยี่ห้อ */}
        {step === 0 && (
          <div>
            <SectionTitle icon="🏷" title="เลือกยี่ห้อแก๊ส"
              sub="เลือกยี่ห้อถังแก๊สที่ต้องการ"/>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {BRANDS.map(b => (
                <div key={b.id} onClick={() => setBrand(b.id)} style={{
                  background:   brand === b.id ? b.bgColor : WHITE,
                  border:       `2px solid ${brand === b.id ? b.color : "#E5E7EB"}`,
                  borderRadius:  14, padding: "16px 12px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  transition: "all .15s",
                  boxShadow: brand === b.id
                    ? `0 4px 16px ${b.color}30` : "0 1px 3px rgba(0,0,0,.05)",
                }}>
                  <BrandImage brand={b} size={60}/>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, textAlign: "center" }}>
                    {b.name}
                  </div>
                  {brand === b.id && (
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: WHITE,
                      padding: "3px 12px", borderRadius: 10,
                      background: b.color,
                    }}>✓ เลือกแล้ว</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — สินค้า */}
        {step === 1 && (
          <div>
            <SectionTitle icon="🛢" title="เลือกขนาดถังแก๊ส"
              sub={`ยี่ห้อ ${brandObj?.name}`}/>

            {/* brand chip */}
            {brandObj && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16,
                background: brandObj.bgColor,
                border: `1.5px solid ${brandObj.color}`,
                borderRadius: 20, padding: "5px 14px",
              }}>
                <BrandImage brand={brandObj} size={20}/>
                <span style={{ fontSize: 13, fontWeight: 700, color: brandObj.color }}>
                  {brandObj.name}
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PRODUCTS.map(p => {
                return (
                  <div key={p.id} onClick={() => { setProduct(p.id); setQty(1); }} style={{
                    background:   product === p.id ? "#EEF2FF" : WHITE,
                    border:       `2px solid ${product === p.id ? NAVY : "#E5E7EB"}`,
                    borderRadius:  14, padding: "13px 15px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 13,
                    transition: "all .15s", position: "relative",
                    boxShadow: product === p.id
                      ? "0 4px 16px rgba(26,43,107,.12)" : "0 1px 3px rgba(0,0,0,.05)",
                  }}>
                    {p.hot && (
                      <div style={{
                        position: "absolute", top: -9, right: 12,
                        background: `linear-gradient(135deg,${ORANGE},${ORANGE2})`,
                        color: WHITE, fontSize: 9, fontWeight: 800,
                        padding: "3px 10px", borderRadius: 10,
                      }}>🔥 ขายดี</div>
                    )}
                    <div style={{ fontSize: 30 }}>{p.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: GRAY, marginTop: 1 }}>{p.desc}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>฿{p.homePrice}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Qty selector */}
            {product && (
              <div style={{
                marginTop: 16, background: WHITE, borderRadius: 14,
                padding: 16, border: "1.5px solid #E5E7EB",
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
                  จำนวนถัง
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} style={{
                    width: 38, height: 38, borderRadius: 10,
                    border: "2px solid #E5E7EB", background: WHITE,
                    fontSize: 20, cursor: "pointer", fontWeight: 700, color: NAVY,
                  }}>−</button>
                  <span style={{ fontSize: 24, fontWeight: 900, color: NAVY,
                    minWidth: 30, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(qty + 1)} style={{
                    width: 38, height: 38, borderRadius: 10,
                    border: `2px solid ${ORANGE}`, background: "#FFF7ED",
                    fontSize: 20, cursor: "pointer", fontWeight: 700, color: ORANGE,
                  }}>+</button>
                  <div style={{ marginLeft: "auto" }}>
                    <div style={{ fontSize: 11, color: GRAY }}>ยอดรวม</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ORANGE }}>
                      ฿{total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — ที่อยู่ / แผนที่ */}
        {step === 2 && (
          <div>
            <SectionTitle icon="🗺" title="ระบุตำแหน่งจัดส่ง"
              sub="แตะแผนที่หรือลากหมุดไปที่บ้าน/ร้านของคุณ"/>

            <MapPicker
              onLocationSelect={handleLocationSelect}
              locationData={locData}
            />

            {/* หมายเหตุ */}
            {locData?.zone && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="💬 หมายเหตุเพิ่มเติม เช่น หน้าบ้านมีป้ายสีแดง บ้านตรงหัวซอย (ไม่บังคับ)"
                  style={{
                    width: "100%", height: 68, padding: "10px 12px",
                    borderRadius: 12, border: "2px solid #E5E7EB",
                    fontSize: 13, resize: "none", color: GRAY,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — ยืนยัน */}
        {step === 3 && (
          <div>
            <SectionTitle icon="✅" title="ตรวจสอบออเดอร์"
              sub="กรุณาตรวจสอบข้อมูลก่อนยืนยัน"/>

            {/* ─── Discount Code ─── */}
            <div style={{ marginBottom: 14 }}>
              {discountCode && DISCOUNT_CODES[discountCode] ? (
                <div style={{
                  background: "#F0FDF4", border: "1.5px solid #86EFAC",
                  borderRadius: 12, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>
                    🏷 โค้ด <strong>{discountCode}</strong> · ลด ฿{DISCOUNT_CODES[discountCode]}
                  </span>
                  <button onClick={() => { setDiscountCode(""); localStorage.removeItem("discountCode"); setDiscountMsg(null); }}
                    style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 12 }}>
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={discountInput}
                    onChange={e => { setDiscountInput(e.target.value); setDiscountMsg(null); }}
                    onKeyDown={e => e.key === "Enter" && applyDiscount()}
                    placeholder="โค้ดส่วนลด (สำหรับถัง 15 กก.)"
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 10,
                      border: `1.5px solid ${discountMsg?.ok === false ? "#FCA5A5" : "#E5E7EB"}`,
                      fontSize: 13, outline: "none",
                    }}
                  />
                  <button onClick={applyDiscount} style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: NAVY, color: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>ใช้โค้ด</button>
                </div>
              )}
              {discountMsg && !discountCode && (
                <div style={{ fontSize: 12, marginTop: 6, color: discountMsg.ok ? "#16A34A" : "#DC2626" }}>
                  {discountMsg.text}
                </div>
              )}
            </div>

            <div style={{
              background: WHITE, borderRadius: 16, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(0,0,0,.08)", marginBottom: 14,
            }}>
              {/* card header */}
              <div style={{
                background: `linear-gradient(135deg,${NAVY2},${NAVY})`,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
              }}>
                <Logo size={26}/>
                <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>
                  สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
                </span>
              </div>

              <div style={{ padding: "4px 16px 14px" }}>
                {[
                  ["🏷 ยี่ห้อ",  brandObj?.name],
                  ["🛢 สินค้า",  `${prod?.icon} ${prod?.name} × ${qty} ถัง`],
                  ["📍 ที่อยู่",  locData?.address],
                  ["📏 ระยะทาง", `~${locData?.distKm?.toFixed(1)} กม.`],
                  note ? ["💬 หมายเหตุ", note] : null,
                  discountAmt > 0 ? ["🏷 ส่วนลด", `-฿${discountAmt}`] : null,
                  ["💰 ยอดรวม",  `฿${total.toLocaleString()}`],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "9px 0", borderBottom: "1px solid #F3F4F6",
                    fontSize: k === "💰 ยอดรวม" ? 15 : 13,
                    fontWeight: k === "💰 ยอดรวม" ? 900 : 400,
                  }}>
                    <span style={{ color: GRAY, flexShrink: 0 }}>{k}</span>
                    <span style={{
                      color: k === "💰 ยอดรวม" ? ORANGE : NAVY,
                      maxWidth: "62%", textAlign: "right", wordBreak: "break-word",
                    }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "#FFF7ED", borderRadius: 12, padding: 12,
              fontSize: 12, color: "#92400E", display: "flex", gap: 8,
            }}>
              <span>⏱</span>
              <span>จัดส่งโดยประมาณ <strong>30–60 นาที</strong> หลังยืนยัน
                · ระบบแจ้งสถานะทุกขั้นตอนผ่าน LINE</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Bar ─── */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 460, boxSizing: "border-box",
        background: WHITE, padding: "12px 16px 24px",
        boxShadow: "0 -4px 20px rgba(0,0,0,.1)",
        display: "flex", gap: 10,
      }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: 1, padding: 14, borderRadius: 12,
            border: "2px solid #E5E7EB", background: WHITE,
            fontWeight: 700, fontSize: 14, cursor: "pointer", color: NAVY,
          }}>← กลับ</button>
        )}
        <button
          onClick={handleNext}
          disabled={!canNext}
          style={{
            flex: step === 0 ? 1 : 2, padding: 14, borderRadius: 12, border: "none",
            background: canNext
              ? `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)` : "#E5E7EB",
            color: canNext ? WHITE : "#9CA3AF",
            fontWeight: 800, fontSize: 14,
            cursor: canNext ? "pointer" : "default",
            boxShadow: canNext ? "0 4px 16px rgba(26,43,107,.3)" : "none",
            transition: "all .2s",
          }}
        >
          {step === 3 ? "🛵 ยืนยันสั่งแก๊สเลย!"
            : step === 2 ? "ตรวจสอบออเดอร์ →"
            : "ถัดไป →"}
        </button>
      </div>
    </div>
  );
}

// ── Done screen ───────────────────────────────────────────────────────────────
function DoneScreen({ orderId, prod, qty, brandObj, locData, total, note, onReset }) {
  return (
    <div style={{
      minHeight: "100vh", background: LGRAY,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: WHITE, borderRadius: 24, padding: 28,
        maxWidth: 400, width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px rgba(0,0,0,.12)",
      }}>
        <Logo size={60}/>
        <div style={{ fontSize: 50, margin: "14px 0 8px" }}>🎉</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 4 }}>
          สั่งซื้อสำเร็จแล้วค่ะ!
        </h1>
        <p style={{
          fontFamily: "monospace", fontSize: 22, fontWeight: 900,
          color: ORANGE, letterSpacing: 1, marginBottom: 20,
        }}>#{orderId}</p>

        <div style={{
          background: LGRAY, borderRadius: 14, padding: 16,
          textAlign: "left", marginBottom: 16,
        }}>
          {[
            ["🏷 ยี่ห้อ",   brandObj?.name],
            ["🛢 สินค้า",   `${prod?.name} × ${qty} ถัง`],
            ["📍 ที่อยู่",   locData?.address?.slice(0, 50) + (locData?.address?.length > 50 ? "..." : "")],
            note ? ["💬 หมายเหตุ", note] : null,
            ["💰 ยอดชำระ",  `฿${total?.toLocaleString()}`],
            ["⏱ ประมาณ",   "30–60 นาที"],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, marginBottom: 7, gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ color: GRAY, flexShrink: 0 }}>{k}</span>
              <span style={{ fontWeight: 600, color: NAVY, textAlign: "right",
                wordBreak: "break-word", maxWidth: "60%" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: "#EEF2FF", borderRadius: 12, padding: 12,
          fontSize: 12, color: NAVY, marginBottom: 20, lineHeight: 1.7,
        }}>
          📱 ระบบจะส่งอัปเดตสถานะผ่าน <strong>LINE</strong> ให้อัตโนมัติทุกขั้นตอนค่ะ
        </div>

        <button onClick={onReset} style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`,
          color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer",
        }}>สั่งอีกรอบ</button>
      </div>
    </div>
  );
}
