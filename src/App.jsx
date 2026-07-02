import { useState, useEffect, useCallback } from "react";
import liff from "@line/liff";
import MapPicker from "./components/MapPicker.jsx";
import qrBase64 from "./assets/qrBase64.js";
import QRPayment from "./components/QRPayment.jsx";

const LIFF_ID = "2010449303-edxrP9ho";
const API = import.meta.env.VITE_API_URL || "";
const NAVY = "#1A2B6B", NAVY2 = "#0F1D52", ORANGE = "#F47B20", ORANGE2 = "#E55C00";
const WHITE = "#FFFFFF", LGRAY = "#F4F6FB", GRAY = "#6B7280";

const STEPS = ["เลือกสินค้า", "ข้อมูล", "ที่อยู่", "ยืนยัน"];

// ── localStorage ─────────────────────────────────────────────────────────────
const ls = {
  getCustomer: () => { try { return JSON.parse(localStorage.getItem("skg_customer") || "null"); } catch { return null; } },
  setCustomer: (v) => localStorage.setItem("skg_customer", JSON.stringify(v)),
  getSavedOrders: () => { try { return JSON.parse(localStorage.getItem("skg_saved_orders") || "[]"); } catch { return []; } },
  setSavedOrders: (v) => localStorage.setItem("skg_saved_orders", JSON.stringify(v.slice(0, 10))),
  getDiscount: () => localStorage.getItem("skg_discount") || "",
  setDiscount: (v) => v ? localStorage.setItem("skg_discount", v) : localStorage.removeItem("skg_discount"),
  addSavedOrder(order) {
    const saved = this.getSavedOrders();
    const idx = saved.findIndex(s => s.brandId === order.brandId && s.productId === order.productId);
    if (idx >= 0) saved.splice(idx, 1);
    saved.unshift(order);
    this.setSavedOrders(saved);
  },
};

function Logo({ size = 48 }) {
  return <img src="/images/Logo Sanuka.png" alt="สกุณาแก๊ส" width={size} height={size}
    style={{ objectFit: "contain", borderRadius: "50%" }} />;
}

function StepBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= step ? ORANGE : "rgba(255,255,255,.2)" }}/>}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: i < step ? ORANGE : i === step ? WHITE : "rgba(255,255,255,.2)",
              color: i < step ? WHITE : i === step ? NAVY : "rgba(255,255,255,.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800,
              boxShadow: i === step ? "0 0 0 3px rgba(255,255,255,.3)" : "none",
            }}>{i < step ? "✓" : i + 1}</div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? ORANGE : "rgba(255,255,255,.2)" }}/>}
          </div>
          <div style={{ fontSize: 8, marginTop: 3, color: i === step ? WHITE : "rgba(255,255,255,.4)", fontWeight: i === step ? 700 : 400 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

function BrandImage({ brand, size = 56 }) {
  const [err, setErr] = useState(false);
  if (brand.logoUrl && !err)
    return <img src={brand.logoUrl} alt={brand.name} onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 10, padding: 4, background: brand.bgColor || "#EEF2FF" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${brand.color || NAVY},${brand.color || NAVY}BB)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: WHITE, fontWeight: 900, fontSize: size * 0.28 }}>{brand.name.slice(0, 3)}</span>
    </div>
  );
}

// ── Cart Item row ─────────────────────────────────────────────────────────────
function CartItem({ item, onRemove, onQtyChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
      borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{item.brandName} · {item.productName}</div>
        <div style={{ fontSize: 11, color: GRAY }}>฿{Number(item.unitPrice).toLocaleString()} / ถัง</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => onQtyChange(Math.max(1, item.qty - 1))}
          style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #E5E7EB", background: WHITE, fontSize: 16, cursor: "pointer", color: NAVY }}>−</button>
        <span style={{ fontWeight: 700, color: NAVY, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
        <button onClick={() => onQtyChange(item.qty + 1)}
          style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${ORANGE}`, background: "#FFF7ED", fontSize: 16, cursor: "pointer", color: ORANGE }}>+</button>
      </div>
      <div style={{ fontWeight: 800, color: ORANGE, fontSize: 14, minWidth: 60, textAlign: "right" }}>
        ฿{(Number(item.unitPrice) * item.qty).toLocaleString()}
      </div>
      <button onClick={onRemove} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
    </div>
  );
}

// ── Saved Order Card ──────────────────────────────────────────────────────────
function SavedOrderCard({ saved, idx, brands, products, lineUserId, onReordered, onDelete, onSave }) {
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing]       = useState(false);
  const [form, setForm]             = useState({ qty: saved.qty, note: saved.note || "", discountCode: saved.discountCode || "" });
  const brand = brands.find(b => b.id === saved.brandId);
  const prod  = products.find(p => p.id === saved.productId);
  if (!brand || !prod) return null;

  function saveEdit() {
    onSave(idx, { ...saved, qty: Number(form.qty) || 1, note: form.note, discountCode: form.discountCode });
    setEditing(false);
  }

  async function handleReorder() {
    setSubmitting(true);
    try {
      const base = {
        lineUserId, brandId: saved.brandId, productId: saved.productId,
        qty: saved.qty, customerName: saved.customerName,
        customerPhone: saved.customerPhone, deliveryLat: saved.lat,
        deliveryLng: saved.lng, deliveryAddress: saved.address,
        paymentMethod: saved.paymentMethod, note: saved.note || "",
      };
      let res = await fetch(`${API}/api/v1/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...base, discountCode: saved.discountCode || undefined }),
      });
      let data = await res.json();
      if (!res.ok && saved.discountCode) {
        res = await fetch(`${API}/api/v1/orders`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base),
        });
        data = await res.json();
      }
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      onReordered({ ...data.order, _showQR: saved.paymentMethod === "qr" });
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ background: WHITE, borderRadius: 14, padding: "12px 14px",
      boxShadow: "0 2px 10px rgba(0,0,0,.06)", border: "1.5px solid #E5E7EB" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <BrandImage brand={brand} size={36}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: NAVY }}>{brand.name} · {prod.name} × {saved.qty}</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 1 }}>📍 {saved.address?.slice(0, 40)}{saved.address?.length > 40 ? "..." : ""}</div>
          {saved.discountCode && <div style={{ fontSize: 10, color: "#16A34A", marginTop: 1 }}>🏷 โค้ด: {saved.discountCode}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setEditing(true)} style={{ padding: "4px 8px", borderRadius: 7, border: `1.5px solid ${NAVY}`, background: WHITE, color: NAVY, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️</button>
          <button onClick={() => { if (confirm("ลบรายการนี้?")) onDelete(idx); }} style={{ padding: "4px 8px", borderRadius: 7, border: "1.5px solid #EF4444", background: WHITE, color: "#EF4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑</button>
        </div>
      </div>
      <button onClick={handleReorder} disabled={submitting} style={{
        width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
        background: submitting ? "#E5E7EB" : `linear-gradient(135deg,${ORANGE},${ORANGE2})`,
        color: WHITE, fontWeight: 700, fontSize: 13, cursor: submitting ? "default" : "pointer" }}>
        {submitting ? "กำลังส่ง..." : "⚡ สั่งซ้ำเลย!"}
      </button>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>✏️ แก้ไขรายการ</div>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: GRAY, marginBottom: 14 }}>{brand.name} · {prod.name}</div>
            {[["จำนวน (ถัง)", "qty", "number"], ["หมายเหตุ", "note", "text"], ["โค้ดส่วนลด", "discountCode", "text"]].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{label}</div>
                <input type={type} value={form[key]} min={type === "number" ? 1 : undefined}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <button onClick={saveEdit} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [lineUserId, setLineUserId] = useState(null);
  const [brands, setBrands]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [savedOrders, setSavedOrders] = useState([]);

  // Shopping state
  const [step, setStep]             = useState(0);
  const [selBrand, setSelBrand]     = useState(null); // currently selecting brand
  const [selProduct, setSelProduct] = useState(null); // currently selecting product
  const [selQty, setSelQty]         = useState(1);
  const [cart, setCart]             = useState([]); // [{brandId,brandName,brandLogoUrl,brandColor,brandBgColor,productId,productName,unitPrice,qty}]

  // Customer / delivery
  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [locData, setLocData]             = useState(null);
  const [note, setNote]                   = useState("");

  // Discount
  const [discountInput, setDiscountInput] = useState("");
  const [discountCode, setDiscountCode]   = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountApplicableIds, setDiscountApplicableIds] = useState([]); // productIds the discount applies to
  const [discountMsg, setDiscountMsg]     = useState(null);
  const [validatingCode, setValidatingCode] = useState(false);

  const handleLocationSelect = useCallback(d => setLocData(d), []);
  const [submitting, setSubmitting] = useState(false);
  const [doneOrders, setDoneOrders] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showPreQR, setShowPreQR] = useState(false); // QR before order created
  const [storeSetting, setStoreSetting] = useState({ forceClose: false, forceOpen: false, warningMessage: "", warningStart: "18:00" });

  useEffect(() => {
    const saved = ls.getCustomer();
    if (saved) { setCustomerName(saved.name || ""); setCustomerPhone(saved.phone || ""); setPaymentMethod(saved.paymentMethod || "cash"); }
    const savedCode = ls.getDiscount();
    if (savedCode) { setDiscountInput(savedCode); } // pre-fill only; user must tap "ใช้โค้ด" to validate
    setSavedOrders(ls.getSavedOrders());
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/settings/store`).then(r => r.json()).then(setStoreSetting).catch(() => {});

    async function initLiff() {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          if (!saved?.name) setCustomerName(profile.displayName || "");
        } else { liff.login(); }
      } catch { setLineUserId("dev-user"); }
    }
    async function loadData() {
      try {
        const [bRes, pRes] = await Promise.all([fetch(`${API}/api/v1/products/brands`), fetch(`${API}/api/v1/products`)]);
        const bData = await bRes.json(); const pData = await pRes.json();
        setBrands(Array.isArray(bData) ? bData : bData.brands || []);
        setProducts(Array.isArray(pData) ? pData : pData.products || []);
      } catch (e) { setError("โหลดข้อมูลสินค้าไม่ได้ กรุณาลองใหม่"); }
      setLoading(false);
    }
    initLiff(); loadData();
  }, []);

  // Cart totals
  const cartSubtotal = cart.reduce((s, i) => s + Number(i.unitPrice) * i.qty, 0);
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  const currentBrandObj = brands.find(b => b.id === selBrand);
  const currentProd     = products.find(p => p.id === selProduct);

  function addToCart() {
    if (!selBrand || !selProduct) return;
    const b = brands.find(b => b.id === selBrand);
    const p = products.find(p => p.id === selProduct);
    setCart(prev => {
      const idx = prev.findIndex(i => i.brandId === selBrand && i.productId === selProduct);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + selQty };
        return next;
      }
      return [...prev, { brandId: selBrand, brandName: b.name, brandLogoUrl: b.logoUrl, brandColor: b.color, brandBgColor: b.bgColor, productId: selProduct, productName: p.name, unitPrice: p.homePrice, qty: selQty }];
    });
    setSelBrand(null); setSelProduct(null); setSelQty(1);
  }

  async function validateDiscount() {
    if (!discountInput.trim()) return;
    setValidatingCode(true); setDiscountMsg(null);
    try {
      const res = await fetch(`${API}/api/v1/discounts/validate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountInput.trim().toUpperCase(),
          cart: cart.map(i => ({ productId: i.productId, subtotal: Number(i.unitPrice) * i.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDiscountMsg({ ok: false, text: data.error }); setDiscountAmount(0); setDiscountCode(""); setDiscountApplicableIds([]); ls.setDiscount(""); }
      else {
        setDiscountCode(discountInput.trim().toUpperCase());
        setDiscountAmount(data.discount);
        setDiscountApplicableIds(data.applicableProductIds || []);
        const restricted = data.applicableProductIds?.length < cart.length;
        setDiscountMsg({ ok: true, text: `ลดได้ ฿${data.discount.toLocaleString()}!${restricted ? " (เฉพาะสินค้าที่ร่วมรายการ)" : ""}` });
        ls.setDiscount(discountInput.trim().toUpperCase());
      }
    } catch (e) { setDiscountMsg({ ok: false, text: e.message || "ตรวจสอบไม่ได้ กรุณาลองใหม่" }); }
    finally { setValidatingCode(false); }
  }

  async function submitOrders() {
    setSubmitting(true);
    const results = [];
    try {
      for (const item of cart) {
        const codeForItem = (discountCode && discountApplicableIds.includes(item.productId)) ? discountCode : undefined;
        const payload = {
          lineUserId, brandId: item.brandId, productId: item.productId,
          qty: item.qty, customerName, customerPhone,
          deliveryLat: locData.lat, deliveryLng: locData.lng,
          deliveryAddress: locData.address, paymentMethod,
          discountCode: codeForItem, note,
        };
        let res = await fetch(`${API}/api/v1/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        let data = await res.json();
        // If discount code caused a rejection, retry without it
        if (!res.ok && codeForItem) {
          res = await fetch(`${API}/api/v1/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, discountCode: undefined }) });
          data = await res.json();
        }
        if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
        results.push(data.order);
        // Save each item as a saved order template
        ls.addSavedOrder({
          brandId: item.brandId, productId: item.productId, qty: item.qty,
          customerName, customerPhone, paymentMethod,
          lat: locData.lat, lng: locData.lng, address: locData.address,
          note, discountCode: discountCode || "",
        });
      }
      ls.setCustomer({ name: customerName, phone: customerPhone, paymentMethod });
      setDoneOrders(results.map(o => ({ ...o, _showQR: paymentMethod === "qr" })));
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  }

  function handleReset() {
    setDoneOrders(null); setStep(0); setCart([]);
    setSelBrand(null); setSelProduct(null); setSelQty(1);
    setLocData(null); setNote(""); setShowNewOrder(false);
    setSavedOrders(ls.getSavedOrders());
    // Keep discount code if saved
    const savedCode = ls.getDiscount();
    setDiscountInput(savedCode); setDiscountCode(savedCode);
    setDiscountAmount(0); setDiscountApplicableIds([]); setDiscountMsg(null);
  }

  const canNext = [
    cart.length > 0,
    !!(customerName.trim() && customerPhone.trim().length >= 9),
    !!(locData && locData.zone),
    true,
  ][step];

  function handleNext() {
    if (step < 3) setStep(step + 1);
    else if (paymentMethod === "qr") setShowPreQR(true); // show QR first, submit after payment
    else submitOrders();
  }

  // QR: show for first order if QR payment
  const qrOrder = doneOrders?.find(o => o._showQR);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: LGRAY }}>
      <Logo size={64}/><div style={{ fontSize: 14, color: GRAY }}>กำลังโหลด...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: LGRAY, padding: 24 }}>
      <Logo size={64}/><div style={{ fontSize: 14, color: "#DC2626", textAlign: "center" }}>{error}</div>
      <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 700, cursor: "pointer" }}>ลองใหม่</button>
    </div>
  );

  // Pre-order QR: show QR before creating order, submit after customer confirms payment
  if (showPreQR) {
    const preTotal = cart.reduce((s, item) => {
      const applicable = discountCode && discountApplicableIds.includes(item.productId);
      const itemTotal = item.unitPrice * item.qty;
      return s + (applicable ? itemTotal - discountAmount : itemTotal);
    }, 0);
    return (
      <PreQRScreen total={preTotal} onConfirmed={() => { setShowPreQR(false); submitOrders(); }} onBack={() => setShowPreQR(false)} />
    );
  }

  if (qrOrder) return (
    <QRPayment order={qrOrder} onDone={() => setDoneOrders(prev => prev.map(o => o.id === qrOrder.id ? { ...o, _showQR: false } : o))} />
  );

  if (doneOrders) return <DoneScreen orders={doneOrders} onReset={handleReset} />;

  // Business hours + force close check
  const now  = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isSun = now.getDay() === 0;
  const closeHour = isSun ? 13 : 19;
  const isOpen = hour >= 7 && hour < closeHour;
  const forceClose = storeSetting?.forceClose === true;
  const forceOpen  = storeSetting?.forceOpen  === true;

  // Warning banner: show when within warningStart time
  const warningMsg = storeSetting?.warningMessage;
  const warningStart = storeSetting?.warningStart;
  let showWarning = false;
  if (warningStart && (isOpen || forceOpen) && !forceClose) {
    const [wh, wm] = warningStart.split(":").map(Number);
    const wHour = wh + wm / 60;
    showWarning = hour >= wHour;
  }

  if ((!isOpen && !forceOpen) || forceClose) return (
    <div style={{ minHeight: "100vh", background: LGRAY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: WHITE, borderRadius: 24, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,.12)" }}>
        <Logo size={64}/>
        <div style={{ fontSize: 44, margin: "16px 0 8px" }}>🌙</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: NAVY, marginBottom: 8 }}>ขณะนี้ร้านปิดแล้วค่ะ</h1>
        <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.7, marginBottom: 16 }}>
          เวลาทำการ<br/>
          จันทร์–เสาร์: 07:00–19:00 น.<br/>
          อาทิตย์: 07:00–13:00 น.
        </p>
        <div style={{ background: "#EEF2FF", borderRadius: 12, padding: 12, fontSize: 13, color: NAVY, fontWeight: 700 }}>
          กรุณาสั่งใหม่วันพรุ่งนี้ตั้งแต่ 07:00 น. ค่ะ
        </div>
      </div>
    </div>
  );

  // Reorder home screen
  const showReorder = savedOrders.length > 0 && !showNewOrder && step === 0 && cart.length === 0 && !selBrand;

  return (
    <div style={{ minHeight: "100vh", background: LGRAY }}>
      {/* Warning banner */}
      {showWarning && warningMsg && (
        <div style={{ background: "#FEF3C7", borderBottom: "2px solid #F59E0B", padding: "10px 16px", fontSize: 13, color: "#92400E", fontWeight: 600, lineHeight: 1.7 }}>
          {warningMsg.split("\n").map((line, i) => (
            <div key={i}>{i === 0 ? "⚠️ " : "• "}{line}</div>
          ))}
        </div>
      )}
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${NAVY2},${NAVY})`, padding: "16px 20px 20px",
        position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(10,18,50,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: showReorder ? 0 : 16 }}>
          <Logo size={44}/>
          <div>
            <div style={{ color: WHITE, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>สกุณา<span style={{ color: ORANGE }}>แก๊ส</span></div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 10, marginTop: 2 }}>ปลอดภัย มั่นใจ ได้มาตรฐาน</div>
          </div>
          <div style={{ marginLeft: "auto", background: "rgba(255,255,255,.12)", borderRadius: 20, padding: "4px 10px", fontSize: 10, color: "rgba(255,255,255,.85)", whiteSpace: "nowrap" }}>
            🕐 {new Date().getDay() === 0 ? "07:00–13:00" : "07:00–19:00"}
          </div>
        </div>
        {!showReorder && <StepBar step={step}/>}
      </div>

      <div style={{ padding: "18px 16px 140px", maxWidth: 460, margin: "0 auto" }}>

        {/* ── Reorder home ── */}
        {showReorder && (
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>⚡ สั่งซ้ำรายการที่บันทึก</div>
              <button onClick={() => setShowNewOrder(true)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: `2px solid ${NAVY}`, background: WHITE, color: NAVY, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ สั่งใหม่</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedOrders.map((so, i) => (
                <SavedOrderCard key={i} idx={i} saved={so} brands={brands} products={products} lineUserId={lineUserId}
                  onReordered={(order) => { setSavedOrders(ls.getSavedOrders()); setDoneOrders([order]); }}
                  onDelete={(idx) => { const next = savedOrders.filter((_, j) => j !== idx); ls.setSavedOrders(next); setSavedOrders(next); }}
                  onSave={(idx, updated) => { const next = savedOrders.map((s, j) => j === idx ? updated : s); ls.setSavedOrders(next); setSavedOrders(next); }} />
              ))}
            </div>
          </div>
        )}

        {/* ── New order flow ── */}
        {!showReorder && (
          <>
            {/* STEP 0 — เลือกสินค้า */}
            {step === 0 && (
              <div>
                {/* Cart preview */}
                {cart.length > 0 && (
                  <div style={{ background: WHITE, borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🛒 ตะกร้าสินค้า</div>
                    {cart.map((item, idx) => (
                      <CartItem key={idx} item={item}
                        onRemove={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                        onQtyChange={(qty) => setCart(prev => prev.map((it, i) => i === idx ? { ...it, qty } : it))} />
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 800, fontSize: 14 }}>
                      <span style={{ color: GRAY }}>รวม</span>
                      <span style={{ color: ORANGE }}>฿{cartSubtotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Brand selection */}
                {!selBrand ? (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 12 }}>🏷 เลือกยี่ห้อแก๊ส</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {brands.map(b => (
                        <div key={b.id} onClick={() => setSelBrand(b.id)} style={{
                          background: WHITE, border: "2px solid #E5E7EB",
                          borderRadius: 14, padding: "16px 12px", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                          boxShadow: "0 1px 3px rgba(0,0,0,.05)", transition: "all .15s",
                        }}>
                          <BrandImage brand={b} size={60}/>
                          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{b.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
                      <button onClick={() => { setSelBrand(null); setSelProduct(null); setSelQty(1); }}
                        style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: NAVY }}>←</button>
                      <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>🛢 เลือกขนาด · {currentBrandObj?.name}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {products.map(p => (
                        <div key={p.id} onClick={() => { setSelProduct(p.id); setSelQty(1); }} style={{
                          background: selProduct === p.id ? "#EEF2FF" : WHITE,
                          border: `2px solid ${selProduct === p.id ? NAVY : "#E5E7EB"}`,
                          borderRadius: 14, padding: "13px 15px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 13, position: "relative",
                          boxShadow: selProduct === p.id ? "0 4px 16px rgba(26,43,107,.12)" : "0 1px 3px rgba(0,0,0,.05)",
                        }}>
                          {p.isHot && <div style={{ position: "absolute", top: -9, right: 12,
                            background: `linear-gradient(135deg,${ORANGE},${ORANGE2})`,
                            color: WHITE, fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>🔥 ขายดี</div>}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{p.name}</div>
                            {p.description && <div style={{ fontSize: 11, color: GRAY }}>{p.description}</div>}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>฿{Number(p.homePrice).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>

                    {selProduct && (
                      <div style={{ marginTop: 14, background: WHITE, borderRadius: 14, padding: 14, border: "1.5px solid #E5E7EB" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>จำนวน</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <button onClick={() => setSelQty(Math.max(1, selQty - 1))} style={{ width: 38, height: 38, borderRadius: 10, border: "2px solid #E5E7EB", background: WHITE, fontSize: 20, cursor: "pointer", color: NAVY }}>−</button>
                          <span style={{ fontSize: 24, fontWeight: 900, color: NAVY, minWidth: 28, textAlign: "center" }}>{selQty}</span>
                          <button onClick={() => setSelQty(selQty + 1)} style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${ORANGE}`, background: "#FFF7ED", fontSize: 20, cursor: "pointer", color: ORANGE }}>+</button>
                          <div style={{ marginLeft: "auto", fontWeight: 900, fontSize: 20, color: ORANGE }}>฿{(Number(currentProd?.homePrice) * selQty).toLocaleString()}</div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                          <button onClick={addToCart} style={{
                            flex: 1, padding: "12px 0", borderRadius: 12, border: `2px solid ${NAVY}`,
                            background: WHITE, color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                            + เพิ่มลงตะกร้า
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 1 — ข้อมูลลูกค้า */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 16 }}>👤 ข้อมูลผู้สั่ง</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>ชื่อ-นามสกุล *</label>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="เช่น สมชาย ใจดี"
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>เบอร์โทรศัพท์ *</label>
                    <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0812345678" type="tel"
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 6 }}>วิธีชำระเงิน</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {[["cash","💵 เงินสด"],["qr","📱 QR Code"]].map(([val,label]) => (
                        <div key={val} onClick={() => setPaymentMethod(val)} style={{
                          flex: 1, padding: "12px 0", borderRadius: 12, textAlign: "center",
                          border: `2px solid ${paymentMethod === val ? NAVY : "#E5E7EB"}`,
                          background: paymentMethod === val ? "#EEF2FF" : WHITE,
                          fontWeight: 700, fontSize: 14, color: paymentMethod === val ? NAVY : GRAY, cursor: "pointer" }}>{label}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — ที่อยู่ */}
            {step === 2 && (
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 16 }}>🗺 ระบุตำแหน่งจัดส่ง</div>
                <MapPicker onLocationSelect={handleLocationSelect} locationData={locData}/>
                {locData?.zone && (
                  <div style={{ marginTop: 12 }}>
                    <textarea value={note} onChange={e => setNote(e.target.value)}
                      placeholder="💬 หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                      style={{ width: "100%", height: 68, padding: "10px 12px", borderRadius: 12, border: "2px solid #E5E7EB", fontSize: 13, resize: "none", color: GRAY, boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — ยืนยัน */}
            {step === 3 && (
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 16 }}>✅ ตรวจสอบออเดอร์</div>

                {/* Cart summary */}
                <div style={{ background: WHITE, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,.08)", marginBottom: 14 }}>
                  <div style={{ background: `linear-gradient(135deg,${NAVY2},${NAVY})`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo size={26}/>
                    <span style={{ color: WHITE, fontWeight: 800, fontSize: 14 }}>สกุณา<span style={{ color: ORANGE }}>แก๊ส</span></span>
                  </div>
                  <div style={{ padding: "8px 16px 14px" }}>
                    {cart.map((item, i) => {
                      const itemSubtotal = Number(item.unitPrice) * item.qty;
                      const hasDiscount = discountAmount > 0 && (discountApplicableIds.length === 0 || discountApplicableIds.includes(item.productId));
                      return (
                        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: GRAY }}>{item.brandName} · {item.productName} ×{item.qty}</span>
                            <span style={{ color: NAVY, fontWeight: 700 }}>฿{itemSubtotal.toLocaleString()}</span>
                          </div>
                          {hasDiscount && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                              <span style={{ color: "#16A34A", fontSize: 11 }}>🏷 ส่วนลด {discountCode}</span>
                              <span style={{ color: "#16A34A", fontSize: 11, fontWeight: 700 }}>-฿{discountAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {[
                      ["👤 ชื่อ", customerName],
                      ["📞 เบอร์", customerPhone],
                      ["💳 ชำระ", paymentMethod === "cash" ? "เงินสด" : "QR Code"],
                      ["📍 ที่อยู่", locData?.address],
                      ["📏 ระยะ", `~${locData?.distKm?.toFixed(1)} กม.`],
                      note ? ["💬 หมายเหตุ", note] : null,
                    ].filter(Boolean).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                        <span style={{ color: GRAY, flexShrink: 0 }}>{k}</span>
                        <span style={{ color: NAVY, maxWidth: "62%", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 900 }}>
                      <span style={{ color: GRAY }}>💰 ยอดรวม</span>
                      <span style={{ color: ORANGE }}>฿{cartTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Discount code */}
                <div style={{ background: WHITE, borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>🏷 โค้ดส่วนลด</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={discountInput} onChange={e => { setDiscountInput(e.target.value); setDiscountMsg(null); }}
                      onKeyDown={e => e.key === "Enter" && validateDiscount()}
                      placeholder="กรอกโค้ดส่วนลด (ถ้ามี)"
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 10,
                        border: `1.5px solid ${discountMsg?.ok === false ? "#FCA5A5" : discountMsg?.ok ? "#86EFAC" : "#E5E7EB"}`,
                        fontSize: 13, outline: "none" }} />
                    <button onClick={validateDiscount} disabled={validatingCode} style={{
                      padding: "10px 16px", borderRadius: 10, border: "none",
                      background: validatingCode ? "#E5E7EB" : NAVY, color: WHITE, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {validatingCode ? "..." : "ใช้โค้ด"}
                    </button>
                  </div>
                  {discountMsg && (
                    <div style={{ fontSize: 12, marginTop: 6, color: discountMsg.ok ? "#16A34A" : "#DC2626", fontWeight: 700 }}>
                      {discountMsg.ok ? "✅" : "❌"} {discountMsg.text}
                    </div>
                  )}
                  {discountCode && <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>💾 จำโค้ดนี้ไว้สำหรับครั้งถัดไปแล้ว</div>}
                </div>

                <div style={{ background: "#FFF7ED", borderRadius: 12, padding: 12, fontSize: 12, color: "#92400E", display: "flex", gap: 8 }}>
                  <span>⏱</span><span>จัดส่งโดยประมาณ <strong>30–60 นาที</strong> · ระบบแจ้งสถานะผ่าน LINE</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Bar */}
      {!showReorder && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 460, boxSizing: "border-box",
          background: WHITE, padding: "12px 16px 24px", boxShadow: "0 -4px 20px rgba(0,0,0,.1)" }}>

          {/* Step 0: cart actions */}
          {step === 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              {cart.length > 0 && (
                <button onClick={() => setStep(1)} style={{
                  flex: 2, padding: 14, borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: WHITE,
                  fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(26,43,107,.3)" }}>
                  ดำเนินการต่อ ({cart.length} รายการ) →
                </button>
              )}
              {cart.length === 0 && selProduct && (
                <button onClick={addToCart} style={{
                  flex: 1, padding: 14, borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: WHITE,
                  fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  + เพิ่มลงตะกร้า
                </button>
              )}
            </div>
          )}

          {/* Steps 1-3 */}
          {step > 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, fontSize: 14, cursor: "pointer", color: NAVY }}>← กลับ</button>
              <button onClick={handleNext} disabled={!canNext || submitting} style={{
                flex: 2, padding: 14, borderRadius: 12, border: "none",
                background: canNext && !submitting ? `linear-gradient(135deg,${NAVY},${NAVY2})` : "#E5E7EB",
                color: canNext && !submitting ? WHITE : "#9CA3AF",
                fontWeight: 800, fontSize: 14, cursor: canNext && !submitting ? "pointer" : "default",
                boxShadow: canNext ? "0 4px 16px rgba(26,43,107,.3)" : "none" }}>
                {submitting ? "กำลังส่ง..." : step === 3 ? "🛵 ยืนยันสั่งแก๊สเลย!" : step === 2 ? "ตรวจสอบออเดอร์ →" : "ถัดไป →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS = {
  pending:          { label: "รอรับงาน",      icon: "⏳", color: "#92400E", bg: "#FEF3C7" },
  preparing:        { label: "เตรียมสินค้า",  icon: "📦", color: "#1E40AF", bg: "#DBEAFE" },
  out_for_delivery: { label: "กำลังส่ง",      icon: "🛵", color: "#075985", bg: "#E0F2FE" },
  near_destination: { label: "ใกล้ถึงแล้ว",  icon: "📍", color: "#065F46", bg: "#D1FAE5" },
  delivered:        { label: "ส่งสำเร็จแล้ว",icon: "✅", color: "#065F46", bg: "#D1FAE5" },
  cancelled:        { label: "ยกเลิก",        icon: "❌", color: "#991B1B", bg: "#FEE2E2" },
};

function DoneScreen({ orders, onReset }) {
  const API = import.meta.env.VITE_API_URL || "";
  const total = orders.reduce((s, o) => s + Number(o.total), 0);
  const [tracking, setTracking] = useState(false);
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    if (!tracking) return;
    async function poll() {
      const results = await Promise.all(
        orders.map(o => fetch(`${API}/api/v1/orders/${o.id}`).then(r => r.json()).catch(() => null))
      );
      const map = {};
      results.forEach((r, i) => { if (r) map[orders[i].id] = r.status; });
      setStatuses(map);
    }
    poll();
    const iv = setInterval(poll, 15000);
    return () => clearInterval(iv);
  }, [tracking]);

  if (tracking) {
    return (
      <div style={{ minHeight: "100vh", background: LGRAY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: WHITE, borderRadius: 24, padding: 28, maxWidth: 400, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,.12)" }}>
          <Logo size={50}/>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: NAVY, margin: "12px 0 16px", textAlign: "center" }}>ติดตามคำสั่งซื้อ</h1>
          {orders.map((o, i) => {
            const st = STATUS_LABELS[statuses[o.id]] || STATUS_LABELS.pending;
            return (
              <div key={i} style={{ background: LGRAY, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>#{o.orderNumber}</span>
                  <span style={{ fontSize: 13, color: GRAY }}>{o.product?.name} × {o.qty}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: st.bg, borderRadius: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: 22 }}>{st.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: st.color }}>{st.label}</div>
                    {statuses[o.id] === "delivered" && (
                      <div style={{ fontSize: 11, color: st.color, marginTop: 2 }}>ได้รับสินค้าเรียบร้อยแล้วค่ะ</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: GRAY, textAlign: "center", marginBottom: 16 }}>อัปเดตสถานะอัตโนมัติทุก 15 วินาที</div>
          <button onClick={onReset} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            สั่งอีกรอบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: LGRAY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: WHITE, borderRadius: 24, padding: 28, maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,.12)" }}>
        <Logo size={60}/>
        <div style={{ fontSize: 50, margin: "14px 0 8px" }}>🎉</div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, marginBottom: 4 }}>สั่งซื้อสำเร็จแล้วค่ะ!</h1>
        <div style={{ background: LGRAY, borderRadius: 14, padding: 14, textAlign: "left", marginBottom: 14 }}>
          {orders.map((o, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: GRAY }}>{o.product?.name} × {o.qty}</span>
              <span style={{ fontWeight: 700, color: ORANGE }}>#{o.orderNumber}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, paddingTop: 8, borderTop: "1px solid #E5E7EB", marginTop: 6 }}>
            <span style={{ color: GRAY }}>รวมทั้งหมด</span>
            <span style={{ color: ORANGE }}>฿{total.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ background: "#EEF2FF", borderRadius: 12, padding: 12, fontSize: 12, color: NAVY, marginBottom: 16, lineHeight: 1.7 }}>
          📱 ระบบจะส่งอัปเดตสถานะผ่าน <strong>LINE</strong> ให้อัตโนมัติทุกขั้นตอนค่ะ
        </div>
        <button onClick={() => setTracking(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: ORANGE, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
          📍 ติดตามคำสั่งซื้อ
        </button>
        <button onClick={onReset} style={{ width: "100%", padding: 14, borderRadius: 12, border: `2px solid ${NAVY}`, background: WHITE, color: NAVY, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          สั่งอีกรอบ
        </button>
      </div>
    </div>
  );
}


function PreQRScreen({ total, onConfirmed, onBack }) {
  const [confirming, setConfirming] = useState(false);
  async function handleConfirm() {
    setConfirming(true);
    await new Promise(r => setTimeout(r, 500));
    onConfirmed();
  }
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg,#0F1D52 0%,#1A2B6B 50%,#2D3F8F 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 28, padding: "28px 24px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 13, color: "#6B7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>ชำระเงินผ่าน PromptPay</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#1A2B6B", marginBottom: 18 }}>สกุณา<span style={{ color: "#F47B20" }}>แก๊ส</span></div>
        <div style={{ background: "linear-gradient(135deg,#0F1D52,#1A2B6B)", borderRadius: 16, padding: "14px 20px", marginBottom: 22 }}>
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: 12, marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
          <div style={{ color: "#FFFFFF", fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ display: "inline-block", padding: 14, background: "#FFFFFF", borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,.12)", border: "1.5px solid #E5E7EB", marginBottom: 18 }}>
          <img src={qrBase64} alt="QR PromptPay" style={{ width: 220, height: 220, objectFit: "contain", display: "block" }} />
        </div>
        <div style={{ background: "#F8FAFF", borderRadius: 14, padding: "12px 16px", marginBottom: 22, border: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1A2B6B", marginBottom: 4 }}>สกุณา</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>PromptPay · ธนาคารกสิกรไทย</div>
        </div>
        <button onClick={handleConfirm} disabled={confirming} style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#059669,#047857)", color: "#FFFFFF", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 16px rgba(5,150,105,.35)", marginBottom: 10 }}>
          {confirming ? "กำลังดำเนินการ..." : "✅ โอนเงินเรียบร้อยแล้ว"}
        </button>
        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 700, background: "#FEF3C7", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>📎 หลังโอนเงินแล้ว กรุณาส่งสลิปในแชท LINE ด้วยนะคะ</div>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 13, color: "#6B7280", cursor: "pointer", textDecoration: "underline" }}>← ย้อนกลับ</button>
      </div>
    </div>
  );
}
