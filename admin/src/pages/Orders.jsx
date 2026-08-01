import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../utils/api.js";
import qrBase64 from "../assets/qrBase64.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

const STATUSES = [
  { key: "",                  label: "ทั้งหมด" },
  { key: "pending",           label: "รอรับงาน",       bg: "#FEF3C7", color: "#92400E" },
  { key: "preparing",         label: "เตรียมสินค้า",   bg: "#DBEAFE", color: "#1E40AF" },
  { key: "out_for_delivery",  label: "กำลังส่ง",       bg: "#E0F2FE", color: "#075985" },
  { key: "near_destination",  label: "ใกล้ถึง",        bg: "#D1FAE5", color: "#065F46" },
  { key: "delivered",         label: "ส่งสำเร็จ",      bg: "#D1FAE5", color: "#065F46" },
  { key: "cancelled",         label: "ยกเลิก",         bg: "#FEE2E2", color: "#991B1B" },
];

const EMPTY_ORDER = { customerName: "", customerPhone: "", brandId: "", productId: "", qty: 1, unitPrice: "", paymentMethod: "cash", deliveryAddress: "", note: "", orderType: "gas" };

function CustomerAutocomplete({ value, onChange, onSelect, placeholder, type = "text" }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);

  function search(q) {
    clearTimeout(timer.current);
    if (!q || q.length < 1) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get(`/api/v1/orders/customer-suggestions?q=${encodeURIComponent(q)}`);
        const data = r.data || [];
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch (err) {
        console.error("autocomplete error:", err);
      }
    }, 200);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        value={value}
        onChange={e => { onChange(e.target.value); search(e.target.value); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || "ไม่ระบุได้"}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "2px solid #E5E7EB", borderRadius: 8, zIndex: 9999, maxHeight: 260, overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,.15)" }}>
          {suggestions.map((c, i) => (
            <div key={i} onMouseDown={() => { onSelect(c); setOpen(false); setSuggestions([]); }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #F3F4F6", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ color: "#1A2B6B", fontSize: 14 }}>{c.customerName}</strong>
                {c.customerPhone && <span style={{ color: "#6B7280", fontSize: 12 }}>{c.customerPhone}</span>}
              </div>
              {(c.brandName || c.productName) && (
                <div style={{ fontSize: 11, color: "#059669", marginTop: 2, fontWeight: 700 }}>
                  ⛽ {c.brandName}{c.weightKg ? ` ${c.weightKg}กก.` : ""}{c.productName && !c.weightKg ? ` · ${c.productName}` : ""}
                </div>
              )}
              {c.addresses?.[0] && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>📍 {c.addresses[0]}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtraItemPicker({ equipList, onAdd }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const item = equipList.find(e => e.id === id);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
      <select value={id} onChange={e => { const it = equipList.find(x => x.id === e.target.value); setId(e.target.value); setPrice(it?.price || ""); }}
        style={{ flex: "1 1 120px", padding: "7px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 12 }}>
        <option value="">-- เลือกสินค้า --</option>
        {equipList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} placeholder="จำนวน"
        style={{ width: 54, padding: "7px 8px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 12 }} />
      <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="ราคา"
        style={{ width: 72, padding: "7px 8px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 12 }} />
      <button onClick={() => {
        if (!item || !price) return;
        onAdd({ id: item.id, name: item.name, qty, price: Number(price) });
        setId(""); setQty(1); setPrice("");
      }} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ เพิ่ม</button>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatus] = useState("");
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_ORDER);
  const [creating, setCreating]     = useState(false);
  const [brands, setBrands]         = useState([]);
  const [products, setProducts]     = useState([]);
  const [search, setSearch]         = useState("");
  const [showWalkin, setShowWalkin] = useState(false);
  const [walkinType, setWalkinType] = useState("gas"); // gas | new_tank | equipment
  const [walkinForm, setWalkinForm] = useState({ customerName: "", customerPhone: "", brandName: "", productId: "", qty: 1, price: "", paymentMethod: "cash", note: "", gasBrand: "", gasWeight: "", stockId: "", equipId: "" });
  const [walkinSaving, setWalkinSaving] = useState(false);
  const [walkinResult, setWalkinResult] = useState(null); // { order, cart }
  const [walkinCart, setWalkinCart]     = useState([]); // cart items before save
  const [gasStocks, setGasStocks]   = useState([]);
  const [equipList, setEquipList]   = useState([]);
  const [extraItems, setExtraItems] = useState({}); // { [orderId]: [{id, name, qty, price}] }
  const [createCustAddrs, setCreateCustAddrs] = useState([]); // addresses of selected customer in create modal
  const [editOrder, setEditOrder]     = useState(null);   // order being edited
  const [editForm,  setEditForm]      = useState({});
  const [editSaving, setEditSaving]   = useState(false);

  const fetch = useCallback(async () => {
    const params = new URLSearchParams({ page, limit: 20 });
    if (statusFilter) params.set("status", statusFilter);
    if (date) params.set("date", date);
    const r = await api.get(`/api/v1/orders?${params}`);
    setOrders(r.data.orders);
    setTotal(r.data.total);
  }, [page, statusFilter, date]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [fetch]);

  useEffect(() => {
    api.get("/api/v1/products/brands").then(r => setBrands(Array.isArray(r.data) ? r.data : r.data.brands || [])).catch(() => {});
    api.get("/api/v1/products?limit=100").then(r => setProducts(Array.isArray(r.data) ? r.data : r.data.products || [])).catch(() => {});
    api.get("/api/v1/stock/gas").then(r => setGasStocks(r.data)).catch(() => {});
    api.get("/api/v1/stock/equipment").then(r => setEquipList(r.data)).catch(() => {});
  }, []);

  async function createOrder() {
    setCreating(true);
    try {
      if (createForm.orderType === "new_tank") {
        const stock = gasStocks.find(s => s.id === createForm.newTankStockId);
        if (!stock) return alert("กรุณาเลือกยี่ห้อและน้ำหนัก");
        if (!createForm.newTankPrice) return alert("กรุณาใส่ราคา");
        if (!createForm.deliveryAddress) return alert("กรุณากรอกที่อยู่จัดส่ง");
        await api.post("/api/v1/orders/walkin", {
          type: "new_tank",
          customerName: createForm.customerName,
          customerPhone: createForm.customerPhone,
          paymentMethod: createForm.paymentMethod,
          note: createForm.note,
          brandName: stock.brandName,
          weightKg: stock.weightKg,
          qty: Number(createForm.qty || 1),
          price: Number(createForm.newTankPrice),
          deliveryAddress: createForm.deliveryAddress,
          orderStatus: "pending",
        });
      } else {
        if (!createForm.deliveryAddress || !createForm.brandId || !createForm.productId)
          return alert("กรุณากรอกที่อยู่จัดส่ง ยี่ห้อ และน้ำหนัก");
        await api.post("/api/v1/orders", {
          ...createForm,
          qty: Number(createForm.qty) || 1,
          ...(createForm.unitPrice ? { unitPrice: Number(createForm.unitPrice) } : {}),
        });
      }
      setShowCreate(false); setCreateForm(EMPTY_ORDER); fetch();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    finally { setCreating(false); }
  }

  function addToWalkinCart() {
    if (walkinType === "gas" || walkinType === "new_tank") {
      const stock = gasStocks.find(s => s.id === walkinForm.stockId);
      if (!stock) return alert("กรุณาเลือกยี่ห้อและน้ำหนัก");
      if (!walkinForm.price) return alert("กรุณาใส่ราคา");
      const prefix = walkinType === "new_tank" ? "🆕 ถังใหม่ " : "⛽ ";
      setWalkinCart(c => [...c, {
        type: walkinType,
        brandName: stock.brandName,
        weightKg: stock.weightKg,
        stockId: stock.id,
        qty: Number(walkinForm.qty || 1),
        price: Number(walkinForm.price),
        label: `${prefix}${stock.brandName} ${stock.weightKg} กก.`,
      }]);
    } else {
      const item = equipList.find(e => e.id === walkinForm.equipId);
      if (!item) return alert("กรุณาเลือกสินค้า");
      const qty = Number(walkinForm.qty || 1);
      const price = Number(walkinForm.price || item.price || 0);
      if (!price) return alert("กรุณาใส่ราคา");
      setWalkinCart(c => [...c, {
        type: "equipment",
        equipId: item.id,
        name: item.name,
        qty,
        price,
        label: `🔧 ${item.name}`,
      }]);
    }
    setWalkinForm(f => ({ ...f, gasBrand: "", gasWeight: "", stockId: "", equipId: "", qty: 1, price: "" }));
  }

  async function saveWalkin() {
    if (walkinCart.length === 0) return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");
    setWalkinSaving(true);
    try {
      const payload = {
        type: "mixed",
        cartItems: walkinCart,
        customerName: walkinForm.customerName,
        customerPhone: walkinForm.customerPhone,
        paymentMethod: walkinForm.paymentMethod,
        note: walkinForm.note,
      };
      const { data: order } = await api.post("/api/v1/orders/walkin", payload);
      setWalkinResult({ order, cart: walkinCart });
      setShowWalkin(false);
      setWalkinCart([]);
      setWalkinForm({ customerName: "", customerPhone: "", brandName: "", productId: "", qty: 1, price: "", paymentMethod: "cash", note: "", gasBrand: "", gasWeight: "", stockId: "", equipId: "" });
      fetch();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    finally { setWalkinSaving(false); }
  }

  function printReceipt(o, extras = []) {
    const d = new Date(o.createdAt);
    const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const discount  = Number(o.discountAmount || 0);
    const subtotal  = Number(o.total) + discount;
    const payLabel  = o.paymentMethod === "cash" ? "เงินสด" : o.paymentMethod === "qr" ? "QR โอน" : "เก็บปลายทาง";
    // Parse walkin note for product label
    let walkinData = null;
    if (o.note?.startsWith("__walkin:")) {
      try { walkinData = JSON.parse(o.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
    }
    let productLabel = ((o.brand?.name || "") + " " + (o.product?.name || "")).trim();
    if (!productLabel && walkinData) {
      if (walkinData.type === "new_tank") productLabel = `🆕 ถังใหม่ ${walkinData.brandName} ${walkinData.weightKg}กก.`;
      else if (walkinData.type === "gas") productLabel = `${walkinData.brandName} ${walkinData.weightKg}กก.`;
      else if (walkinData.type === "equipment") productLabel = (walkinData.items || []).map(i => i.name).join(", ") || "อุปกรณ์";
    }
    const displayQty = walkinData?.qty ?? o.qty ?? 1;
    const unitPrice = walkinData?.unitPrice ?? (displayQty > 0 ? Math.round(subtotal / displayQty) : 0);
    const isEquip = walkinData?.type === "equipment";
    const qtyUnit = isEquip ? " ชิ้น" : " ถัง";
    let itemsHtml = `<tr><td>${productLabel || "-"}</td><td style="text-align:center;">${displayQty}${qtyUnit}</td><td style="text-align:right;">${Number(unitPrice).toLocaleString()}</td><td style="text-align:right;">${subtotal.toLocaleString()}</td></tr>`;
    let total = Number(o.total);
    for (const ex of extras) {
      const lineTotal = Number(ex.price) * Number(ex.qty);
      itemsHtml += `<tr><td>${ex.name}</td><td style="text-align:center;">${ex.qty} ชิ้น</td><td style="text-align:right;">${Number(ex.price).toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
      total += lineTotal;
    }
    if (discount > 0) {
      itemsHtml += `<tr><td colspan="3" style="font-size:13px; font-weight:800; color:#000;">ส่วนลด${o.discountCode ? ` (${o.discountCode})` : ""}</td><td style="text-align:right; font-weight:800; color:#000;">-${discount.toLocaleString()}</td></tr>`;
    }
    const displayNote = (() => {
      const n = o.note || "";
      if (!n || n.startsWith("__walkin:")) return n.split("\n").slice(1).join("\n").trim();
      return n.trim();
    })();
    openReceiptWindow(o, itemsHtml, total, dateStr, timeStr, payLabel, displayNote);
  }

  function printWalkinReceipt(order, cart) {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const payLabel = order.paymentMethod === "cash" ? "เงินสด" : order.paymentMethod === "qr" ? "QR โอน" : "เก็บปลายทาง";
    let total = 0;
    let itemsHtml = "";
    for (const it of (cart || [])) {
      const qty = Number(it.qty || 1);
      const price = Number(it.price || 0);
      const lineTotal = qty * price;
      total += lineTotal;
      const name = it.label || it.name || it.brandName || "สินค้า";
      const unit = it.type === "equipment" ? " ชิ้น" : " ถัง";
      itemsHtml += `<tr><td>${name}</td><td style="text-align:center;">${qty}${unit}</td><td style="text-align:right;">${price.toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
    }
    const walkinNote = (() => {
      const n = order.note || "";
      if (n.startsWith("__walkin:")) return n.split("\n").slice(1).join("\n").trim();
      return n.trim();
    })();
    openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel, walkinNote);
  }

  function printReceiptWithExtras(order, extras) {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const payLabel = order.paymentMethod === "cash" ? "เงินสด" : order.paymentMethod === "qr" ? "QR โอน" : "เก็บปลายทาง";
    const discount = Number(order.discountAmount || 0);
    const subtotal = Number(order.total) + discount;
    const unitPrice = order.qty > 0 ? Math.round(subtotal / order.qty) : 0;
    let total = Number(order.total);
    let itemsHtml = `<tr><td>${(order.brand?.name || "") + " " + (order.product?.name || "")}</td><td style="text-align:center;">${order.qty} ถัง</td><td style="text-align:right;">${unitPrice.toLocaleString()}</td><td style="text-align:right;">${subtotal.toLocaleString()}</td></tr>`;
    for (const ex of extras) {
      const lineTotal = Number(ex.price) * Number(ex.qty);
      total += lineTotal;
      itemsHtml += `<tr><td>${ex.name}</td><td style="text-align:center;">${ex.qty} ชิ้น</td><td style="text-align:right;">${Number(ex.price).toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
    }
    if (discount > 0) {
      itemsHtml += `<tr><td colspan="3" style="font-size:13px; font-weight:800; color:#000;">ส่วนลด${order.discountCode ? ` (${order.discountCode})` : ""}</td><td style="text-align:right; font-weight:800; color:#000;">-${discount.toLocaleString()}</td></tr>`;
      total -= discount; // already included in order.total but adding extras so recalc
      total = Number(order.total) + extras.reduce((s, e) => s + Number(e.price) * Number(e.qty), 0);
    }
    const extrasNote = (order.note || "").replace(/^__walkin:.*\n?/, "").trim();
    openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel, extrasNote);
  }

  function openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel, noteText) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>ใบเสร็จ ${order.orderNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; width: 80mm; padding: 10px 10px 16px; font-size: 14px; font-weight: 800; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 900; }
  .solid  { border-top: 2px solid #000; margin: 8px 0; }
  .dash   { border-top: 1.5px dashed #000; margin: 8px 0; }
  .double { border-top: 3px double #000; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 4px; font-size: 14px; font-weight: 800; color: #000; }
  @media print { body { margin:0; } @page { margin:0; size:80mm auto; } }
</style></head><body>
<div class="center bold" style="font-size:30px; font-weight:900; letter-spacing:2px; margin-bottom:4px;">🔥 สกุณาแก๊ส</div>
<div class="center" style="font-size:14px; font-weight:800; color:#000; margin-bottom:2px;">โทร 097-121-3054 | 092-631-4331 | 02-970-9385</div>
<div class="center" style="font-size:13px; font-weight:800; color:#000; margin-bottom:6px;">39 ซอยพหลโยธิน 48 แขวงท่าแร้ง เขตบางเขน กทม. 10220</div>
<div class="solid"></div>
<table style="margin-bottom:8px;">
  <tr>
    <td style="width:55%; font-size:14px; font-weight:800;">ลูกค้า: ${order.customerName || "ลูกค้าทั่วไป"}</td>
    <td style="width:45%; text-align:right; font-size:11px; font-weight:400;">วันที่ ${dateStr}</td>
  </tr>
  <tr>
    <td style="font-size:13px; font-weight:800; padding-top:2px;">เลขออเดอร์: <b>${order.orderNumber}</b></td>
    <td style="text-align:right; font-size:11px; font-weight:400; padding-top:2px;">เวลา ${timeStr} น.</td>
  </tr>
  <tr><td colspan="2" style="padding-top:4px; font-size:14px; font-weight:800;">📞 ${order.customerPhone || "-"} &nbsp;|&nbsp; 💳 ${payLabel}</td></tr>
  <tr><td colspan="2" style="word-break:break-word; font-size:14px; font-weight:800; padding-top:3px;">📍 ${order.deliveryAddress || "-"}</td></tr>
</table>
<div class="dash"></div>
<table>
  <thead>
    <tr style="border-bottom:1.5px solid #000;">
      <th style="text-align:left; width:36%; font-size:14px; padding-right:4px;">รายการ</th>
      <th style="text-align:center; width:22%; font-size:14px; padding:0 4px;">จำนวน</th>
      <th style="text-align:right; width:20%; font-size:14px; padding:0 4px;">ราคา/ชิ้น</th>
      <th style="text-align:right; width:22%; font-size:14px;">รวม</th>
    </tr>
  </thead>
  <tbody>
    <tr style="height:8px;"></tr>
    ${itemsHtml}
    <tr style="height:16px;"></tr>
  </tbody>
</table>
<div class="solid"></div>
<table style="margin-bottom:4px;">
  <tr>
    <td class="bold" style="font-size:16px;">รวมทั้งสิ้น</td>
    <td style="text-align:right; font-size:16px;" class="bold">${total.toLocaleString()}</td>
    <td style="padding-left:4px; font-size:16px;" class="bold">บาท</td>
  </tr>
</table>
<div class="double"></div>
${noteText ? `<div style="margin-top:8px; padding:6px 8px; border:1.5px dashed #000; border-radius:4px; font-size:13px; font-weight:800;">💬 หมายเหตุ: ${noteText}</div>` : ""}
<div class="dash" style="margin-top:6px;"></div>
<div class="center" style="font-size:13px; font-weight:800; margin:6px 0 4px;">สแกนโอนเงิน PromptPay</div>
<div class="center"><img src="${qrBase64}" style="width:48mm; height:48mm; object-fit:contain;" /></div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:3px;">สกุณา</div>
<div class="dash" style="margin-top:8px;"></div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:6px;">ขอบคุณที่ใช้บริการค่ะ</div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:3px;">สแกนโอนเงิน PromptPay</div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:2px;">นาง รุจิรา ดวงเพ็ชรแสง (KBank)</div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:4px;">ขอบคุณที่ใช้บริการค่ะ</div>
<script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }</script>
</body></html>`;
    const w = window.open("", "_blank", "width=420,height=700");
    w.document.write(html);
    w.document.close();
  }

  async function updateStatus(orderId, status) {
    setUpdating(true);
    await api.put(`/api/v1/orders/${orderId}/status`, { status });
    setUpdating(false);
    fetch();
    if (selected?.id === orderId) setSelected(s => ({ ...s, status }));
  }

  async function togglePaid(orderId) {
    const { data } = await api.patch(`/api/v1/orders/${orderId}/paid`);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPaid: data.isPaid } : o));
    if (selected?.id === orderId) setSelected(s => ({ ...s, isPaid: data.isPaid }));
  }

  function openEdit(order) {
    setEditOrder(order);
    setEditForm({
      customerName:    order.customerName    || "",
      customerPhone:   order.customerPhone   || "",
      deliveryAddress: order.deliveryAddress || "",
      qty:             order.qty             ?? 1,
      unitPrice:       order.unitPrice       ?? order.total ?? 0,
      total:           order.total           ?? 0,
      paymentMethod:   order.paymentMethod   || "cash",
      note:            (() => {
        // strip __walkin: prefix from note for display
        const n = order.note || "";
        if (n.startsWith("__walkin:")) return n.split("\n").slice(1).join("\n").trim();
        return n;
      })(),
    });
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const qty   = Number(editForm.qty   || 1);
      const price = Number(editForm.unitPrice || 0);
      const payload = {
        customerName:    editForm.customerName,
        customerPhone:   editForm.customerPhone,
        deliveryAddress: editForm.deliveryAddress,
        qty,
        unitPrice: price,
        total:     qty * price,
        paymentMethod: editForm.paymentMethod,
        note: editForm.note,
      };
      const { data: updated } = await api.put(`/api/v1/orders/${editOrder.id}`, payload);
      setSelected(s => s?.id === editOrder.id ? { ...s, ...updated } : s);
      setOrders(prev => prev.map(o => o.id === editOrder.id ? { ...o, ...updated } : o));
      setEditOrder(null);
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    finally { setEditSaving(false); }
  }

  const st = (key) => STATUSES.find(s => s.key === key) || STATUSES[0];

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Left: List */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: selected ? 340 : 0, transition: "padding-right .2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>📦 ออเดอร์</h1>
          <span style={{ fontSize: 13, color: GRAY }}>{total} รายการ</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowWalkin(true)} style={{ padding: "7px 14px", borderRadius: 8, background: "#10B981", color: WHITE, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🏪 ขายหน้าร้าน</button>
            <button onClick={() => setShowCreate(true)} style={{ padding: "7px 14px", borderRadius: 8, background: ORANGE, color: WHITE, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ เพิ่มออเดอร์</button>
          </div>
        </div>
        <input placeholder="🔍 ค้นหาออเดอร์, ลูกค้า, เบอร์..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "8px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }} />
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 13 }}>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          {orders.filter(o => !search || [o.orderNumber, o.customerName, o.customerPhone, o.deliveryAddress, o.product?.name].some(v => String(v||"").toLowerCase().includes(search.toLowerCase()))).map(o => {
            const s = st(o.status);
            return (
              <div key={o.id} onClick={() => setSelected(o)} style={{
                padding: "12px 16px", borderBottom: "1px solid #F3F4F6",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: selected?.id === o.id ? "#EEF2FF" : WHITE,
                transition: "background .1s",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 11, background: s.bg, color: s.color, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{s.label}</span>
                    <span onClick={e => { e.stopPropagation(); togglePaid(o.id); }} style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 700, cursor: "pointer",
                      background: o.isPaid ? "#D1FAE5" : "#FEE2E2",
                      color: o.isPaid ? "#065F46" : "#991B1B",
                    }}>{o.isPaid ? "✅ จ่ายแล้ว" : "⏳ ยังไม่จ่าย"}</span>
                  </div>
                  <p style={{ fontSize: 12, color: NAVY }}>{o.customerName} · {o.customerPhone}</p>
                  <p style={{ fontSize: 12, color: GRAY }}>{o.product?.name} ×{o.qty} · ฿{Number(o.total).toLocaleString()}</p>
                  {o.deliveryAddress && <p style={{ fontSize: 11, color: "#6B7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {o.deliveryAddress}</p>}
                  {o.driver && <p style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>🛵 {o.driver.name}</p>}
                </div>
                <div style={{ fontSize: 11, color: GRAY, textAlign: "right", flexShrink: 0 }}>
                  {new Date(o.createdAt).toLocaleTimeString("th-TH", { timeStyle: "short" })}
                </div>
              </div>
            );
          })}
          {!orders.length && <p style={{ textAlign: "center", color: GRAY, padding: 30 }}>ไม่พบออเดอร์</p>}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY }}>←</button>
          <span style={{ padding: "6px 10px", fontSize: 13, color: GRAY }}>หน้า {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY }}>→</button>
        </div>
      </div>

      {/* Right: Detail */}
      {selected && (() => {
        // parse walkin note for display
        let walkinData = null;
        if (selected.note?.startsWith("__walkin:")) {
          try { walkinData = JSON.parse(selected.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
        }
        const displayBrand = selected.brand?.name || (walkinData?.brandName ?? "-");
        const displayProduct = selected.product?.name
          ? `${selected.product.name} ×${selected.qty}`
          : walkinData
            ? walkinData.type === "new_tank"
              ? `🆕 ถังใหม่ ${walkinData.brandName} ${walkinData.weightKg}กก. ×${walkinData.qty}`
              : walkinData.type === "gas"
                ? `⛽ ${walkinData.brandName} ${walkinData.weightKg}กก. ×${walkinData.qty}`
                : `อุปกรณ์ ×${selected.qty}`
            : `${selected.product?.name || "-"} ×${selected.qty}`;
        return createPortal(
        <div style={{ position: "fixed", top: 60, right: 16, width: 320, background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 4px 24px rgba(0,0,0,.12)", maxHeight: "calc(100vh - 76px)", overflowY: "auto", zIndex: 9999 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{selected.orderNumber}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => togglePaid(selected.id)} style={{
                padding: "6px 10px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: selected.isPaid ? "#D1FAE5" : "#FEE2E2",
                color: selected.isPaid ? "#065F46" : "#991B1B",
              }}>{selected.isPaid ? "✅ จ่ายแล้ว" : "⏳ ยังไม่จ่าย"}</button>
              <button onClick={() => openEdit(selected)} style={{
                padding: "6px 10px", borderRadius: 8, border: `2px solid ${ORANGE}`,
                background: WHITE, color: ORANGE, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>✏️ แก้ไข</button>
              <button onClick={() => {
                const ex = extraItems[selected.id] || [];
                if (ex.length) printReceiptWithExtras(selected, ex);
                else printReceipt(selected);
              }} style={{
                padding: "6px 12px", borderRadius: 8, border: `2px solid ${NAVY}`,
                background: WHITE, color: NAVY, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>🖨 ปริ้น{(extraItems[selected.id]?.length) ? ` (+${extraItems[selected.id].length})` : ""}</button>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY }}>✕</button>
            </div>
          </div>

          {[
            ["🏷 ยี่ห้อ",   displayBrand],
            ["🛢 สินค้า",   displayProduct],
            ["👤 ลูกค้า",   selected.customerName],
            ["📞 โทร",      selected.customerPhone],
            ["📍 ที่อยู่",  selected.deliveryAddress],
            ["💰 ยอดรวม",  `฿${Number(selected.total).toLocaleString()}`],
            ["💳 ชำระ",    selected.paymentMethod === "cash" ? "เงินสด" : selected.paymentMethod === "qr" ? "QR โอน" : "เก็บปลายทาง"],
            ["📏 ระยะทาง", selected.distanceKm ? `${Number(selected.distanceKm).toFixed(1)} กม.` : "-"],
            ["🛵 คนส่ง",   selected.driver?.name || "ยังไม่มีคนรับงาน"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
              <span style={{ color: GRAY, flexShrink: 0, width: 80 }}>{k}</span>
              <span style={{ color: NAVY, wordBreak: "break-word" }}>{v || "-"}</span>
            </div>
          ))}

          {selected.note && (
            <div style={{ marginTop: 10, background: "#FFF7ED", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E" }}>
              💬 {selected.note}
            </div>
          )}

          {selected.slipUrl && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>🧾 สลิปโอนเงิน</p>
              <a href={`${import.meta.env.VITE_API_URL || ""}${selected.slipUrl}`} target="_blank" rel="noreferrer">
                <img src={`${import.meta.env.VITE_API_URL || ""}${selected.slipUrl}`} alt="slip"
                  style={{ width: "100%", maxWidth: 260, borderRadius: 10, border: "2px solid #E5E7EB", cursor: "pointer" }} />
              </a>
            </div>
          )}

          <div style={{ marginTop: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>เปลี่ยนวิธีชำระ</p>
            <div style={{ display: "flex", gap: 6 }}>
              {[["cash","เงินสด"],["qr","โอน"],["cod","เก็บปลายทาง"]].map(([val, label]) => (
                <button key={val} onClick={async () => {
                  await api.put(`/api/v1/orders/${selected.id}/payment`, { paymentMethod: val });
                  setSelected(s => ({ ...s, paymentMethod: val })); fetch();
                }} style={{
                  flex: 1, padding: "6px 4px", borderRadius: 8, border: `2px solid ${selected.paymentMethod === val ? NAVY : "#E5E7EB"}`,
                  background: selected.paymentMethod === val ? "#EEF2FF" : WHITE,
                  color: selected.paymentMethod === val ? NAVY : GRAY, fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>อัปเดตสถานะ</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUSES.filter(s => s.key && s.key !== "cancelled").map(s => (
                <button key={s.key} onClick={() => updateStatus(selected.id, s.key)}
                  disabled={updating || selected.status === s.key}
                  style={{
                    padding: "6px 10px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: selected.status === s.key ? s.bg || "#E5E7EB" : "#F3F4F6",
                    color: selected.status === s.key ? s.color || NAVY : GRAY,
                    opacity: updating ? 0.6 : 1,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extra items for bill */}
          <div style={{ marginTop: 14, borderTop: "1px solid #E5E7EB", paddingTop: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>🛒 เพิ่มรายการในบิล</p>
            {(extraItems[selected.id] || []).map((ex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12 }}>
                <span style={{ flex: 1, color: NAVY }}>{ex.name} ×{ex.qty} = ฿{(ex.price * ex.qty).toLocaleString()}</span>
                <button onClick={() => setExtraItems(prev => {
                  const arr = [...(prev[selected.id] || [])];
                  arr.splice(i, 1);
                  return { ...prev, [selected.id]: arr };
                })} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>
            ))}
            <ExtraItemPicker equipList={equipList} onAdd={item => setExtraItems(prev => ({
              ...prev,
              [selected.id]: [...(prev[selected.id] || []), item],
            }))} />
          </div>
        </div>
        , document.body);
      })()}

      {/* Edit order modal */}
      {editOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>✏️ แก้ไขออเดอร์ {editOrder.orderNumber}</h2>
              <button onClick={() => setEditOrder(null)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>

            {[
              ["ชื่อลูกค้า", "customerName", "text"],
              ["เบอร์โทร",   "customerPhone", "tel"],
              ["ที่อยู่",    "deliveryAddress", "text"],
            ].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{label}</div>
                <input type={type} value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>จำนวน</div>
                <input type="number" min="1" value={editForm.qty || ""} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value, total: Number(e.target.value) * Number(f.unitPrice || 0) }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา/หน่วย (บาท)</div>
                <input type="number" value={editForm.unitPrice || ""} onChange={e => setEditForm(f => ({ ...f, unitPrice: e.target.value, total: Number(f.qty || 1) * Number(e.target.value) }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#166534", fontSize: 13 }}>ยอดรวม</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>฿{(Number(editForm.qty || 1) * Number(editForm.unitPrice || 0)).toLocaleString()}</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>วิธีชำระเงิน</div>
              <select value={editForm.paymentMethod || "cash"} onChange={e => setEditForm(f => ({ ...f, paymentMethod: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                <option value="cash">เงินสด</option>
                <option value="qr">โอน</option>
                <option value="cod">เก็บปลายทาง</option>
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>หมายเหตุ</div>
              <input value={editForm.note || ""} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditOrder(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "2px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveEdit} disabled={editSaving} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: editSaving ? 0.6 : 1 }}>
                {editSaving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in sale modal */}
      {showWalkin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, margin: "auto", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🏪 ขายหน้าร้าน</h2>
              <button onClick={() => { setShowWalkin(false); setWalkinCart([]); }} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>

            {/* Customer info */}
            {(() => {
              function applyWalkinCustomer(c) {
                setWalkinForm(f => {
                  const updated = {
                    ...f,
                    customerName:  c.customerName  || f.customerName  || "",
                    customerPhone: c.customerPhone || f.customerPhone || "",
                  };
                  // autofill gas info if not already selected
                  if (!f.gasBrand && c.brandName) updated.gasBrand = c.brandName;
                  if (!f.gasWeight && c.weightKg)  updated.gasWeight = String(c.weightKg);
                  if (updated.gasBrand && updated.gasWeight) {
                    const s = gasStocks.find(x => x.brandName === updated.gasBrand && Number(x.weightKg) === Number(updated.gasWeight));
                    if (s) updated.stockId = s.id;
                  }
                  return updated;
                });
              }
              return (
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ชื่อลูกค้า</div>
                    <CustomerAutocomplete
                      value={walkinForm.customerName}
                      onChange={v => setWalkinForm(f => ({ ...f, customerName: v }))}
                      onSelect={applyWalkinCustomer}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>เบอร์โทร</div>
                    <CustomerAutocomplete
                      type="tel"
                      value={walkinForm.customerPhone}
                      onChange={v => setWalkinForm(f => ({ ...f, customerPhone: v }))}
                      onSelect={applyWalkinCustomer}
                      placeholder="ไม่ระบุได้"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["gas","⛽ ถังแก๊ส"],["new_tank","🆕 ขายถังใหม่"],["equipment","🔧 อุปกรณ์/เตา"]].map(([k, label]) => (
                <button key={k} onClick={() => setWalkinType(k)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: walkinType === k ? NAVY : "#F3F4F6", color: walkinType === k ? WHITE : GRAY,
                }}>{label}</button>
              ))}
            </div>

            {(walkinType === "gas" || walkinType === "new_tank") ? (() => {
              const brands = [...new Set(gasStocks.map(s => s.brandName))].sort();
              const weights = [...new Set(gasStocks.filter(s => !walkinForm.gasBrand || s.brandName === walkinForm.gasBrand).map(s => Number(s.weightKg)))].sort((a,b)=>a-b);
              const selectedStock = gasStocks.find(s => s.brandName === walkinForm.gasBrand && Number(s.weightKg) === Number(walkinForm.gasWeight));
              const stockQty = walkinType === "new_tank" ? selectedStock?.newTank : selectedStock?.hasGas;
              const stockLabel = walkinType === "new_tank" ? "ถังใหม่" : "ถังมีแก๊ส";
              return (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ *</div>
                      <select value={walkinForm.gasBrand || ""} onChange={e => setWalkinForm(f => ({ ...f, gasBrand: e.target.value, gasWeight: "", stockId: "" }))}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือกยี่ห้อ --</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก *</div>
                      <select value={walkinForm.gasWeight || ""} onChange={e => {
                        const w = e.target.value;
                        const s = gasStocks.find(x => x.brandName === walkinForm.gasBrand && Number(x.weightKg) === Number(w));
                        setWalkinForm(f => ({ ...f, gasWeight: w, stockId: s?.id || "" }));
                      }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือกขนาด --</option>
                        {weights.map(w => <option key={w} value={w}>{w} กก.</option>)}
                      </select>
                    </div>
                  </div>
                  {selectedStock && (
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#166534" }}>
                      {stockLabel}: <strong>{stockQty ?? 0} ถัง</strong>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>จำนวน (ถัง)</div>
                      <input type="number" min="1" value={walkinForm.qty} onChange={e => setWalkinForm(f => ({ ...f, qty: e.target.value }))}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา (บาท)</div>
                      <input type="number" value={walkinForm.price} onChange={e => setWalkinForm(f => ({ ...f, price: e.target.value }))}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                    </div>
                  </div>
                </>
              );
            })() : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>สินค้า *</div>
                  <select value={walkinForm.equipId || ""} onChange={e => {
                    const item = equipList.find(x => x.id === e.target.value);
                    setWalkinForm(f => ({ ...f, equipId: e.target.value, price: item?.price || "" }));
                  }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                    <option value="">-- เลือกสินค้า --</option>
                    {equipList.map(e => (
                      <option key={e.id} value={e.id}>{e.name} — ฿{Number(e.price).toLocaleString()} (มี {e.qty} ชิ้น)</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>จำนวน</div>
                    <input type="number" min="1" value={walkinForm.qty} onChange={e => setWalkinForm(f => ({ ...f, qty: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา (บาท)</div>
                    <input type="number" value={walkinForm.price} onChange={e => setWalkinForm(f => ({ ...f, price: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                </div>
              </>
            )}

            {/* Add to cart button */}
            <button onClick={addToWalkinCart} style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none",
              background: ORANGE, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16,
            }}>➕ เพิ่มใส่ตะกร้า</button>

            {/* Cart */}
            {walkinCart.length > 0 && (
              <div style={{ background: "#F8FAFC", border: "2px solid #E5E7EB", borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🛒 ตะกร้าสินค้า</div>
                {walkinCart.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: idx < walkinCart.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{it.label}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>x{it.qty} × ฿{Number(it.price).toLocaleString()} = <strong>฿{(it.qty * it.price).toLocaleString()}</strong></div>
                    </div>
                    <button onClick={() => setWalkinCart(c => c.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#EF4444", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "2px solid #D1D5DB" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>รวมทั้งสิ้น</span>
                  <span style={{ fontWeight: 900, fontSize: 16, color: "#059669" }}>฿{walkinCart.reduce((s, i) => s + i.qty * i.price, 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ช่องทางชำระเงิน</div>
              <select value={walkinForm.paymentMethod} onChange={e => setWalkinForm(f => ({ ...f, paymentMethod: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                <option value="cash">เงินสด</option>
                <option value="qr">โอน</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>หมายเหตุ</div>
              <input value={walkinForm.note} onChange={e => setWalkinForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <button onClick={saveWalkin} disabled={walkinSaving || walkinCart.length === 0} style={{
              width: "100%", padding: 13, borderRadius: 12, border: "none",
              background: walkinCart.length === 0 ? "#9CA3AF" : "#10B981", color: WHITE, fontWeight: 800, fontSize: 15, cursor: walkinCart.length === 0 ? "not-allowed" : "pointer",
              opacity: walkinSaving ? 0.6 : 1,
            }}>{walkinSaving ? "กำลังบันทึก..." : `✅ บันทึกการขาย${walkinCart.length > 0 ? ` (${walkinCart.length} รายการ)` : ""}`}</button>
          </div>
        </div>
      )}

      {/* Walk-in result modal */}
      {walkinResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>บันทึกการขายสำเร็จ</h2>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>เลขออเดอร์: <strong style={{ color: NAVY }}>{walkinResult.order.orderNumber}</strong></p>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>รายการ: <strong style={{ color: NAVY }}>{(walkinResult.cart || []).length} รายการ</strong></p>
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 20 }}>ยอดรวม: <strong style={{ color: NAVY }}>฿{Number(walkinResult.order.total).toLocaleString()}</strong></p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setWalkinResult(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "2px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>ปิด</button>
              <button onClick={() => { printWalkinReceipt(walkinResult.order, walkinResult.cart); setWalkinResult(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>🖨 ปริ้นใบเสร็จ</button>
            </div>
          </div>
        </div>
      )}

      {/* Create order modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, margin: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>📞 เพิ่มออเดอร์ (ลูกค้าโทรสั่ง)</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["gas","⛽ ถังแก๊ส"],["new_tank","🆕 ถังใหม่"]].map(([k, label]) => (
                <button key={k} onClick={() => setCreateForm(f => ({ ...f, orderType: k }))} style={{
                  flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  background: createForm.orderType === k ? NAVY : "#F3F4F6", color: createForm.orderType === k ? WHITE : GRAY,
                }}>{label}</button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ชื่อลูกค้า</div>
              <CustomerAutocomplete
                value={createForm.customerName}
                onChange={v => setCreateForm(f => ({ ...f, customerName: v }))}
                onSelect={c => {
                  setCreateCustAddrs(c.addresses || []);
                  setCreateForm(f => ({
                    ...f,
                    customerName:    c.customerName || "",
                    customerPhone:   c.customerPhone || f.customerPhone || "",
                    deliveryAddress: f.deliveryAddress || c.addresses?.[0] || c.deliveryAddress || "",
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                  }));
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>เบอร์โทร</div>
              <CustomerAutocomplete
                type="tel"
                value={createForm.customerPhone}
                onChange={v => setCreateForm(f => ({ ...f, customerPhone: v }))}
                onSelect={c => {
                  setCreateCustAddrs(c.addresses || []);
                  setCreateForm(f => ({
                    ...f,
                    customerName:    f.customerName    || c.customerName || "",
                    customerPhone:   c.customerPhone   || "",
                    deliveryAddress: f.deliveryAddress || c.addresses?.[0] || c.deliveryAddress || "",
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                  }));
                }}
                placeholder="ไม่ระบุได้"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ที่อยู่จัดส่ง *</div>
              <CustomerAutocomplete
                value={createForm.deliveryAddress}
                onChange={v => setCreateForm(f => ({ ...f, deliveryAddress: v }))}
                onSelect={c => {
                  setCreateCustAddrs(c.addresses || []);
                  setCreateForm(f => ({
                    ...f,
                    customerName:    f.customerName    || c.customerName || "",
                    customerPhone:   f.customerPhone   || c.customerPhone || "",
                    deliveryAddress: c.addresses?.[0]  || c.deliveryAddress || f.deliveryAddress,
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                  }));
                }}
                placeholder="บ้านเลขที่ ซอย..."
              />
              {createCustAddrs.length > 1 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {createCustAddrs.map((addr, i) => (
                    <button key={i} onClick={() => setCreateForm(f => ({ ...f, deliveryAddress: addr }))}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", background: "#F9FAFB", textAlign: "left", fontSize: 12, color: NAVY, cursor: "pointer" }}>
                      📍 {addr}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>หมายเหตุ</div>
              <input type="text" value={createForm.note} onChange={e => setCreateForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            {createForm.orderType === "gas" ? (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ *</div>
                    <select value={createForm.brandId} onChange={e => setCreateForm(f => ({ ...f, brandId: e.target.value, productId: "", unitPrice: "" }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                      <option value="">-- เลือก --</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก *</div>
                    <select value={createForm.productId} onChange={e => {
                      const pid = e.target.value;
                      const p = products.find(x => x.id === pid);
                      setCreateForm(f => ({ ...f, productId: pid, unitPrice: p?.homePrice ? String(p.homePrice) : f.unitPrice }));
                    }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                      <option value="">-- เลือก --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {createForm.productId && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา (บาท)</div>
                    <input type="number" value={createForm.unitPrice || ""} onChange={e => setCreateForm(f => ({ ...f, unitPrice: e.target.value }))}
                      placeholder="ราคาต่อถัง"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                )}
              </>
            ) : (() => {
              const ntBrands = [...new Set(gasStocks.map(s => s.brandName))].sort();
              const ntWeights = [...new Set(gasStocks.filter(s => !createForm.ntBrand || s.brandName === createForm.ntBrand).map(s => Number(s.weightKg)))].sort((a,b)=>a-b);
              const ntStock = gasStocks.find(s => s.brandName === createForm.ntBrand && Number(s.weightKg) === Number(createForm.ntWeight));
              return (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ *</div>
                      <select value={createForm.ntBrand || ""} onChange={e => setCreateForm(f => ({ ...f, ntBrand: e.target.value, ntWeight: "", newTankStockId: "" }))}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือก --</option>
                        {ntBrands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก *</div>
                      <select value={createForm.ntWeight || ""} onChange={e => {
                        const w = e.target.value;
                        const s = gasStocks.find(x => x.brandName === createForm.ntBrand && Number(x.weightKg) === Number(w));
                        setCreateForm(f => ({ ...f, ntWeight: w, newTankStockId: s?.id || "" }));
                      }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือก --</option>
                        {ntWeights.map(w => <option key={w} value={w}>{w} กก.</option>)}
                      </select>
                    </div>
                  </div>
                  {ntStock && (
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#166534" }}>
                      ถังใหม่ในสต็อก: <strong>{ntStock.newTank} ถัง</strong>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา (บาท) *</div>
                    <input type="number" value={createForm.newTankPrice || ""} onChange={e => setCreateForm(f => ({ ...f, newTankPrice: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                </>
              );
            })()}

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>จำนวน (ถัง)</div>
                <input type="number" min="1" value={createForm.qty} onChange={e => setCreateForm(f => ({ ...f, qty: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ชำระ</div>
                <select value={createForm.paymentMethod} onChange={e => setCreateForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                  <option value="cash">เงินสด</option>
                  <option value="qr">โอน</option>
                  <option value="cod">เก็บปลายทาง</option>
                </select>
              </div>
            </div>
            <button onClick={createOrder} disabled={creating} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: ORANGE, color: WHITE, fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
              {creating ? "กำลังสร้าง..." : "✅ สร้างออเดอร์"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
