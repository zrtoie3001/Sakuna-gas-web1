import { useState, useEffect, useCallback } from "react";
import liff from "@line/liff";
import { getDistanceKm, getZoneFromDist, SHOP_LAT, SHOP_LNG } from "./config.js";
import MapPicker from "./components/MapPicker.jsx";

const LIFF_ID = "2010449303-edxrP9ho";
const API = import.meta.env.VITE_API_URL || "";

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const ORANGE2= "#E55C00";
const WHITE  = "#FFFFFF";
const LGRAY  = "#F4F6FB";
const GRAY   = "#6B7280";

const STEPS = ["ยี่ห้อ", "สินค้า", "ข้อมูล", "ที่อยู่", "ยืนยัน"];

function Logo({ size = 48 }) {
  return (
    <img
      src="/images/Logo Sanuka.png"
      alt="สกุณาแก๊ส"
      width={size}
      height={size}
      style={{ objectFit: "contain", borderRadius: "50%" }}
    />
  );
}

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

function BrandImage({ brand, size = 56 }) {
  const [imgErr, setImgErr] = useState(false);
  const src = brand.logoUrl;

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={brand.name}
        onError={() => setImgErr(true)}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: 10,
          background: brand.bgColor || "#EEF2FF", padding: 4 }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${brand.color || NAVY}, ${brand.color || NAVY}BB)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 4px 12px ${brand.color || NAVY}40`, flexShrink: 0,
    }}>
      <span style={{ color: WHITE, fontWeight: 900, fontSize: size * 0.28 }}>
        {brand.name.slice(0, 3)}
      </span>
    </div>
  );
}

export default function App() {
  const [liffReady, setLiffReady]   = useState(false);
  const [lineUserId, setLineUserId] = useState(null);
  const [brands, setBrands]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const [step, setStep]             = useState(0);
  const [brand, setBrand]           = useState(null);
  const [product, setProduct]       = useState(null);
  const [qty, setQty]               = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [locData, setLocData]       = useState(null);
  const [note, setNote]             = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [discountMsg, setDiscountMsg]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneOrder, setDoneOrder]   = useState(null);

  useEffect(() => {
    async function initLiff() {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          setCustomerName(profile.displayName || "");
        } else {
          liff.login();
        }
      } catch (e) {
        setLineUserId("dev-user");
      }
      setLiffReady(true);
    }

    async function loadData() {
      try {
        const [bRes, pRes] = await Promise.all([
          fetch(`${API}/api/v1/products/brands`),
          fetch(`${API}/api/v1/products`),
        ]);
        const bData = await bRes.json();
        const pData = await pRes.json();
        setBrands(Array.isArray(bData) ? bData : bData.brands || []);
        setProducts(Array.isArray(pData) ? pData : pData.products || []);
      } catch (e) {
        setError("โหลดข้อมูลสินค้าไม่ได้: " + e.message);
      }
      setLoading(false);
    }

    initLiff();
    loadData();
  }, []);

  const prod     = products.find(p => p.id === product);
  const brandObj = brands.find(b => b.id === brand);
  const unitPrice = prod ? Number(prod.homePrice) : 0;
  const subtotal  = unitPrice * qty;
  const deliveryFee = locData?.deliveryFee || 0;
  const total = subtotal + deliveryFee;

  const handleLocationSelect = useCallback((data) => setLocData(data), []);

  const canNext = [
    !!brand,
    !!product,
    !!(customerName.trim() && customerPhone.trim().length >= 9),
    !!(locData && locData.zone),
    true,
  ][step];

  async function handleNext() {
    if (step < 4) { setStep(step + 1); return; }

    // Step 4 = submit
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          brandId: brand,
          productId: product,
          qty,
          customerName,
          customerPhone,
          deliveryLat: locData.lat,
          deliveryLng: locData.lng,
          deliveryAddress: locData.address,
          paymentMethod,
          discountCode: discountCode || undefined,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setDoneOrder(data.order);
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function applyDiscount() {
    setDiscountCode(discountInput.trim().toUpperCase());
    setDiscountMsg({ ok: true, text: "จะตรวจสอบโค้ดตอนยืนยันออเดอร์" });
  }

  function handleReset() {
    setDoneOrder(null); setStep(0); setBrand(null);
    setProduct(null); setQty(1); setLocData(null); setNote("");
    setDiscountCode(""); setDiscountInput(""); setDiscountMsg(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 16, background: LGRAY }}>
        <Logo size={64}/>
        <div style={{ fontSize: 14, color: GRAY }}>กำลังโหลด...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 16, background: LGRAY, padding: 24 }}>
        <Logo size={64}/>
        <div style={{ fontSize: 14, color: "#DC2626", textAlign: "center" }}>{error}</div>
        <button onClick={() => window.location.reload()}
          style={{ padding: "10px 24px", borderRadius: 10, border: "none",
            background: NAVY, color: WHITE, fontWeight: 700, cursor: "pointer" }}>
          ลองใหม่
        </button>
      </div>
    );
  }

  if (doneOrder) {
    return <DoneScreen order={doneOrder} onReset={handleReset} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: LGRAY }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 100%)`,
        padding: "16px 20px 20px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(10,18,50,.35)",
        overflow: "hidden",
      }}>
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

      {/* Content */}
      <div style={{ padding: "18px 16px 120px", maxWidth: 460, margin: "0 auto" }}>

        {/* STEP 0 — ยี่ห้อ */}
        {step === 0 && (
          <div>
            <SectionTitle icon="🏷" title="เลือกยี่ห้อแก๊ส" sub="เลือกยี่ห้อถังแก๊สที่ต้องการ"/>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {brands.map(b => (
                <div key={b.id} onClick={() => setBrand(b.id)} style={{
                  background:   brand === b.id ? (b.bgColor || "#EEF2FF") : WHITE,
                  border:       `2px solid ${brand === b.id ? (b.color || NAVY) : "#E5E7EB"}`,
                  borderRadius:  14, padding: "16px 12px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  transition: "all .15s",
                  boxShadow: brand === b.id ? `0 4px 16px ${b.color || NAVY}30` : "0 1px 3px rgba(0,0,0,.05)",
                }}>
                  <BrandImage brand={b} size={60}/>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, textAlign: "center" }}>
                    {b.name}
                  </div>
                  {brand === b.id && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: WHITE,
                      padding: "3px 12px", borderRadius: 10, background: b.color || NAVY }}>
                      ✓ เลือกแล้ว
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — สินค้า */}
        {step === 1 && (
          <div>
            <SectionTitle icon="🛢" title="เลือกขนาดถังแก๊ส" sub={`ยี่ห้อ ${brandObj?.name}`}/>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {products.map(p => (
                <div key={p.id} onClick={() => { setProduct(p.id); setQty(1); }} style={{
                  background:   product === p.id ? "#EEF2FF" : WHITE,
                  border:       `2px solid ${product === p.id ? NAVY : "#E5E7EB"}`,
                  borderRadius:  14, padding: "13px 15px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 13,
                  transition: "all .15s", position: "relative",
                  boxShadow: product === p.id ? "0 4px 16px rgba(26,43,107,.12)" : "0 1px 3px rgba(0,0,0,.05)",
                }}>
                  {p.isHot && (
                    <div style={{
                      position: "absolute", top: -9, right: 12,
                      background: `linear-gradient(135deg,${ORANGE},${ORANGE2})`,
                      color: WHITE, fontSize: 9, fontWeight: 800,
                      padding: "3px 10px", borderRadius: 10,
                    }}>🔥 ขายดี</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 11, color: GRAY, marginTop: 1 }}>{p.description}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>฿{Number(p.homePrice).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {product && (
              <div style={{ marginTop: 16, background: WHITE, borderRadius: 14,
                padding: 16, border: "1.5px solid #E5E7EB" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>จำนวนถัง</p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} style={{
                    width: 38, height: 38, borderRadius: 10, border: "2px solid #E5E7EB",
                    background: WHITE, fontSize: 20, cursor: "pointer", fontWeight: 700, color: NAVY }}>−</button>
                  <span style={{ fontSize: 24, fontWeight: 900, color: NAVY, minWidth: 30, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(qty + 1)} style={{
                    width: 38, height: 38, borderRadius: 10, border: `2px solid ${ORANGE}`,
                    background: "#FFF7ED", fontSize: 20, cursor: "pointer", fontWeight: 700, color: ORANGE }}>+</button>
                  <div style={{ marginLeft: "auto" }}>
                    <div style={{ fontSize: 11, color: GRAY }}>ยอดรวม</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ORANGE }}>฿{subtotal.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — ข้อมูลลูกค้า */}
        {step === 2 && (
          <div>
            <SectionTitle icon="👤" title="ข้อมูลผู้สั่ง" sub="กรอกชื่อและเบอร์โทรสำหรับติดต่อ"/>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
                  ชื่อ-นามสกุล *
                </label>
                <input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: "2px solid #E5E7EB", fontSize: 14, outline: "none",
                    boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
                  เบอร์โทรศัพท์ *
                </label>
                <input
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="0812345678"
                  type="tel"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: "2px solid #E5E7EB", fontSize: 14, outline: "none",
                    boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>
                  วิธีชำระเงิน
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[["cash", "💵 เงินสด"], ["qr", "📱 QR Code"]].map(([val, label]) => (
                    <div key={val} onClick={() => setPaymentMethod(val)} style={{
                      flex: 1, padding: "12px 0", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${paymentMethod === val ? NAVY : "#E5E7EB"}`,
                      background: paymentMethod === val ? "#EEF2FF" : WHITE,
                      fontWeight: 700, fontSize: 14, color: paymentMethod === val ? NAVY : GRAY,
                      cursor: "pointer",
                    }}>{label}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — ที่อยู่ */}
        {step === 3 && (
          <div>
            <SectionTitle icon="🗺" title="ระบุตำแหน่งจัดส่ง"
              sub="แตะแผนที่หรือลากหมุดไปที่บ้าน/ร้านของคุณ"/>
            <MapPicker onLocationSelect={handleLocationSelect} locationData={locData}/>
            {locData?.zone && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="💬 หมายเหตุเพิ่มเติม เช่น หน้าบ้านมีป้ายสีแดง (ไม่บังคับ)"
                  style={{ width: "100%", height: 68, padding: "10px 12px",
                    borderRadius: 12, border: "2px solid #E5E7EB",
                    fontSize: 13, resize: "none", color: GRAY, boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — ยืนยัน */}
        {step === 4 && (
          <div>
            <SectionTitle icon="✅" title="ตรวจสอบออเดอร์" sub="กรุณาตรวจสอบข้อมูลก่อนยืนยัน"/>

            {/* Discount */}
            <div style={{ marginBottom: 14 }}>
              {discountCode ? (
                <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC",
                  borderRadius: 12, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>
                    🏷 โค้ด <strong>{discountCode}</strong>
                  </span>
                  <button onClick={() => { setDiscountCode(""); setDiscountInput(""); setDiscountMsg(null); }}
                    style={{ background: "none", border: "none", color: GRAY, cursor: "pointer", fontSize: 12 }}>
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={discountInput}
                    onChange={e => { setDiscountInput(e.target.value); setDiscountMsg(null); }}
                    placeholder="โค้ดส่วนลด (ถ้ามี)"
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 10,
                      border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none" }}
                  />
                  <button onClick={applyDiscount} style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: NAVY, color: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ใช้โค้ด
                  </button>
                </div>
              )}
              {discountMsg && (
                <div style={{ fontSize: 12, marginTop: 6, color: discountMsg.ok ? "#16A34A" : "#DC2626" }}>
                  {discountMsg.text}
                </div>
              )}
            </div>

            <div style={{ background: WHITE, borderRadius: 16, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(0,0,0,.08)", marginBottom: 14 }}>
              <div style={{ background: `linear-gradient(135deg,${NAVY2},${NAVY})`,
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <Logo size={26}/>
                <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>
                  สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
                </span>
              </div>
              <div style={{ padding: "4px 16px 14px" }}>
                {[
                  ["🏷 ยี่ห้อ",    brandObj?.name],
                  ["🛢 สินค้า",    `${prod?.name} × ${qty} ถัง`],
                  ["👤 ชื่อ",      customerName],
                  ["📞 เบอร์",     customerPhone],
                  ["💳 ชำระ",     paymentMethod === "cash" ? "เงินสด" : "QR Code"],
                  ["📍 ที่อยู่",   locData?.address],
                  ["📏 ระยะทาง",  `~${locData?.distKm?.toFixed(1)} กม.`],
                  note ? ["💬 หมายเหตุ", note] : null,
                  ["🛵 ค่าส่ง",   "คำนวณโดยร้าน"],
                  ["💰 สินค้า",   `฿${subtotal.toLocaleString()}`],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "9px 0", borderBottom: "1px solid #F3F4F6",
                    fontSize: k === "💰 ยอดรวม" ? 15 : 13,
                    fontWeight: k === "💰 ยอดรวม" ? 900 : 400,
                  }}>
                    <span style={{ color: GRAY, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: k === "💰 ยอดรวม" ? ORANGE : NAVY,
                      maxWidth: "62%", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#FFF7ED", borderRadius: 12, padding: 12,
              fontSize: 12, color: "#92400E", display: "flex", gap: 8 }}>
              <span>⏱</span>
              <span>จัดส่งโดยประมาณ <strong>30–60 นาที</strong> หลังยืนยัน · ระบบแจ้งสถานะทุกขั้นตอนผ่าน LINE</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 460, boxSizing: "border-box",
        background: WHITE, padding: "12px 16px 24px",
        boxShadow: "0 -4px 20px rgba(0,0,0,.1)",
        display: "flex", gap: 10,
      }}>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: 1, padding: 14, borderRadius: 12, border: "2px solid #E5E7EB",
            background: WHITE, fontWeight: 700, fontSize: 14, cursor: "pointer", color: NAVY }}>
            ← กลับ
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!canNext || submitting}
          style={{
            flex: step === 0 ? 1 : 2, padding: 14, borderRadius: 12, border: "none",
            background: canNext && !submitting
              ? `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)` : "#E5E7EB",
            color: canNext && !submitting ? WHITE : "#9CA3AF",
            fontWeight: 800, fontSize: 14,
            cursor: canNext && !submitting ? "pointer" : "default",
            boxShadow: canNext ? "0 4px 16px rgba(26,43,107,.3)" : "none",
            transition: "all .2s",
          }}
        >
          {submitting ? "กำลังส่ง..." :
            step === 4 ? "🛵 ยืนยันสั่งแก๊สเลย!" :
            step === 3 ? "ตรวจสอบออเดอร์ →" :
            "ถัดไป →"}
        </button>
      </div>
    </div>
  );
}

function DoneScreen({ order, onReset }) {
  return (
    <div style={{ minHeight: "100vh", background: LGRAY,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 24 }}>
      <div style={{ background: WHITE, borderRadius: 24, padding: 28,
        maxWidth: 400, width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px rgba(0,0,0,.12)" }}>
        <Logo size={60}/>
        <div style={{ fontSize: 50, margin: "14px 0 8px" }}>🎉</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 4 }}>
          สั่งซื้อสำเร็จแล้วค่ะ!
        </h1>
        <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900,
          color: ORANGE, letterSpacing: 1, marginBottom: 20 }}>
          #{order.orderNumber}
        </p>

        <div style={{ background: LGRAY, borderRadius: 14, padding: 16,
          textAlign: "left", marginBottom: 16 }}>
          {[
            ["🛢 สินค้า",   `${order.product?.name} × ${order.qty} ถัง`],
            ["📍 ที่อยู่",   order.deliveryAddress?.slice(0, 50) + (order.deliveryAddress?.length > 50 ? "..." : "")],
            ["💰 ยอดชำระ",  `฿${Number(order.total).toLocaleString()}`],
            ["⏱ ประมาณ",   "30–60 นาที"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between",
              fontSize: 12, marginBottom: 7, gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: GRAY, flexShrink: 0 }}>{k}</span>
              <span style={{ fontWeight: 600, color: NAVY, textAlign: "right",
                wordBreak: "break-word", maxWidth: "60%" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#EEF2FF", borderRadius: 12, padding: 12,
          fontSize: 12, color: NAVY, marginBottom: 20, lineHeight: 1.7 }}>
          📱 ระบบจะส่งอัปเดตสถานะผ่าน <strong>LINE</strong> ให้อัตโนมัติทุกขั้นตอนค่ะ
        </div>

        <button onClick={onReset} style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`,
          color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          สั่งอีกรอบ
        </button>
      </div>
    </div>
  );
}
