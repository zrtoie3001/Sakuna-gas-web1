import { useState, useEffect, useCallback } from "react";
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

const EMPTY_ORDER = { customerName: "", customerPhone: "", brandId: "", productId: "", qty: 1, paymentMethod: "cash", deliveryAddress: "", note: "", orderType: "gas" };

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
  const [walkinResult, setWalkinResult] = useState(null); // order returned after save
  const [gasStocks, setGasStocks]   = useState([]);
  const [equipList, setEquipList]   = useState([]);
  const [extraItems, setExtraItems] = useState({}); // { [orderId]: [{id, name, qty, price}] }

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
        await api.post("/api/v1/orders", { ...createForm, qty: Number(createForm.qty) || 1 });
      }
      setShowCreate(false); setCreateForm(EMPTY_ORDER); fetch();
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    finally { setCreating(false); }
  }

  async function saveWalkin() {
    setWalkinSaving(true);
    try {
      let payload;
      if (walkinType === "gas" || walkinType === "new_tank") {
        const stock = gasStocks.find(s => s.id === walkinForm.stockId);
        if (!stock) return alert("กรุณาเลือกสินค้า");
        if (!walkinForm.price) return alert("กรุณาใส่ราคา");
        payload = {
          type: walkinType,
          customerName: walkinForm.customerName,
          customerPhone: walkinForm.customerPhone,
          paymentMethod: walkinForm.paymentMethod,
          note: walkinForm.note,
          brandName: stock.brandName,
          weightKg: stock.weightKg,
          qty: Number(walkinForm.qty || 1),
          price: Number(walkinForm.price),
        };
      } else {
        const item = equipList.find(e => e.id === walkinForm.equipId);
        if (!item) return alert("กรุณาเลือกสินค้า");
        payload = {
          type: "equipment",
          customerName: walkinForm.customerName,
          customerPhone: walkinForm.customerPhone,
          paymentMethod: walkinForm.paymentMethod,
          note: walkinForm.note,
          items: [{ id: item.id, name: item.name, qty: Number(walkinForm.qty || 1), price: Number(walkinForm.price || item.price) }],
        };
      }
      const { data: order } = await api.post("/api/v1/orders/walkin", payload);
      setWalkinResult({ order, walkinType, walkinForm: { ...walkinForm } });
      setShowWalkin(false);
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
    const unitPrice = o.qty > 0 ? Math.round(subtotal / o.qty) : 0;
    const payLabel  = o.paymentMethod === "cash" ? "เงินสด" : o.paymentMethod === "qr" ? "QR โอน" : "เก็บปลายทาง";
    let itemsHtml = `<tr><td>${(o.brand?.name || "") + " " + (o.product?.name || "")}</td><td style="text-align:center;">${o.qty}</td><td style="text-align:right;">${unitPrice.toLocaleString()}</td><td style="text-align:right;">${subtotal.toLocaleString()}</td></tr>`;
    let total = Number(o.total);
    for (const ex of extras) {
      const lineTotal = Number(ex.price) * Number(ex.qty);
      itemsHtml += `<tr><td>${ex.name}</td><td style="text-align:center;">${ex.qty}</td><td style="text-align:right;">${Number(ex.price).toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
      total += lineTotal;
    }
    if (discount > 0) {
      itemsHtml += `<tr><td colspan="3" style="font-size:11px; color:#555;">ส่วนลด${o.discountCode ? ` (${o.discountCode})` : ""}</td><td style="text-align:right; color:#059669;">-${discount.toLocaleString()}</td></tr>`;
    }
    openReceiptWindow(o, itemsHtml, total, dateStr, timeStr, payLabel);
  }

  function printWalkinReceipt(order, wType, wForm) {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const payLabel = order.paymentMethod === "cash" ? "เงินสด" : "QR โอน";
    let itemsHtml = "";
    let total = 0;
    if (wType === "gas") {
      const qty = Number(wForm.qty || 1);
      const price = Number(wForm.price || 0);
      const lineTotal = qty * price;
      total = lineTotal;
      const stock = gasStocks.find(s => s.id === wForm.stockId);
      const name = stock ? `${stock.brandName} ${stock.weightKg} กก.` : "ถังแก๊ส";
      itemsHtml = `<tr><td>${name}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">${price.toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
    } else {
      const item = equipList.find(e => e.id === wForm.equipId);
      const qty = Number(wForm.qty || 1);
      const price = Number(wForm.price || item?.price || 0);
      const lineTotal = qty * price;
      total = lineTotal;
      itemsHtml = `<tr><td>${item?.name || "สินค้า"}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">${price.toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
    }
    openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel);
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
    let itemsHtml = `<tr><td>${(order.brand?.name || "") + " " + (order.product?.name || "")}</td><td style="text-align:center;">${order.qty}</td><td style="text-align:right;">${unitPrice.toLocaleString()}</td><td style="text-align:right;">${subtotal.toLocaleString()}</td></tr>`;
    for (const ex of extras) {
      const lineTotal = Number(ex.price) * Number(ex.qty);
      total += lineTotal;
      itemsHtml += `<tr><td>${ex.name}</td><td style="text-align:center;">${ex.qty}</td><td style="text-align:right;">${Number(ex.price).toLocaleString()}</td><td style="text-align:right;">${lineTotal.toLocaleString()}</td></tr>`;
    }
    if (discount > 0) {
      itemsHtml += `<tr><td colspan="3" style="font-size:11px; color:#555;">ส่วนลด${order.discountCode ? ` (${order.discountCode})` : ""}</td><td style="text-align:right; color:#059669;">-${discount.toLocaleString()}</td></tr>`;
      total -= discount; // already included in order.total but adding extras so recalc
      total = Number(order.total) + extras.reduce((s, e) => s + Number(e.price) * Number(e.qty), 0);
    }
    openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel);
  }

  function openReceiptWindow(order, itemsHtml, total, dateStr, timeStr, payLabel) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>ใบเสร็จ ${order.orderNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; width: 80mm; padding: 10px 10px 16px; font-size: 14px; font-weight: 700; color: #000; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 900; }
  .solid  { border-top: 1.5px solid #000; margin: 8px 0; }
  .dash   { border-top: 1px dashed #000; margin: 8px 0; }
  .double { border-top: 3px double #000; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 2px; font-size: 13px; font-weight: 700; }
  @media print { body { margin:0; } @page { margin:0; size:80mm auto; } }
</style></head><body>
<div class="center bold" style="font-size:30px; font-weight:900; letter-spacing:2px; margin-bottom:4px;">🔥 สกุณาแก๊ส</div>
<div class="center" style="font-size:11px; color:#333; margin-bottom:2px;">โทร 097-121-3054 | 092-631-4331 | 02-970-9385</div>
<div class="center" style="font-size:11px; color:#333; margin-bottom:6px;">39 ซอยพหลโยธิน 48 แขวงท่าแร้ง เขตบางเขน กทม. 10220</div>
<div class="solid"></div>
<table style="margin-bottom:8px;">
  <tr>
    <td style="width:55%; font-weight:700;">ลูกค้า: ${order.customerName || "ลูกค้าทั่วไป"}</td>
    <td style="width:45%; text-align:right; font-size:11px;">วันที่ ${dateStr}</td>
  </tr>
  <tr>
    <td style="font-size:11px; padding-top:2px;">เลขออเดอร์: <b>${order.orderNumber}</b></td>
    <td style="text-align:right; font-size:11px; padding-top:2px;">เวลา ${timeStr} น.</td>
  </tr>
  <tr><td colspan="2" style="padding-top:3px; font-size:11px;">📞 ${order.customerPhone || "-"} &nbsp;|&nbsp; 💳 ${payLabel}</td></tr>
  <tr><td colspan="2" style="word-break:break-word; font-size:11px; padding-top:2px;">📍 ${order.deliveryAddress || "-"}</td></tr>
</table>
<div class="dash"></div>
<table>
  <thead>
    <tr style="border-bottom:1px solid #000;">
      <th style="text-align:left; width:40%;">รายการ</th>
      <th style="text-align:center; width:15%;">จำนวน</th>
      <th style="text-align:right; width:22%;">ราคา/ชิ้น</th>
      <th style="text-align:right; width:23%;">รวม</th>
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
    <td class="bold">รวมทั้งสิ้น</td>
    <td style="text-align:right;" class="bold">${total.toLocaleString()}</td>
    <td style="padding-left:4px;" class="bold">บาท</td>
  </tr>
</table>
<div class="double"></div>
<div class="dash" style="margin-top:6px;"></div>
<div class="center" style="font-size:12px; margin:6px 0 4px;">สแกนโอนเงิน PromptPay</div>
<div class="center"><img src="${qrBase64}" style="width:48mm; height:48mm; object-fit:contain;" /></div>
<div class="center" style="font-size:12px; margin-top:3px;">สกุณา</div>
<div class="dash" style="margin-top:8px;"></div>
<div class="center" style="font-size:12px; margin-top:6px;">ขอบคุณที่ใช้บริการค่ะ</div>
<div class="center" style="font-size:11px; font-weight:700; margin-top:3px;">สแกนโอนเงิน PromptPay</div>
<div class="center" style="font-size:11px; margin-top:2px;">นาง รุจิรา ดวงเพ็ชรแสง (KBank)</div>
<div class="center" style="font-size:12px; margin-top:4px;">ขอบคุณที่ใช้บริการค่ะ</div>
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

  const st = (key) => STATUSES.find(s => s.key === key) || STATUSES[0];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Left: List */}
      <div style={{ flex: "1 1 500px" }}>
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
          {orders.filter(o => !search || [o.orderNumber, o.customerName, o.customerPhone, o.product?.name].some(v => String(v||"").toLowerCase().includes(search.toLowerCase()))).map(o => {
            const s = st(o.status);
            return (
              <div key={o.id} onClick={() => setSelected(o)} style={{
                padding: "12px 16px", borderBottom: "1px solid #F3F4F6",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: selected?.id === o.id ? "#EEF2FF" : WHITE,
                transition: "background .1s",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 11, background: s.bg, color: s.color, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: NAVY }}>{o.customerName} · {o.customerPhone}</p>
                  <p style={{ fontSize: 12, color: GRAY }}>{o.product?.name} ×{o.qty} · ฿{Number(o.total).toLocaleString()}</p>
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
        return (
        <div style={{ flex: "0 0 320px", background: WHITE, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)", alignSelf: "flex-start", position: "sticky", top: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{selected.orderNumber}</h2>
            <div style={{ display: "flex", gap: 8 }}>
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
        );
      })()}

      {/* Walk-in sale modal */}
      {showWalkin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, margin: "auto", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🏪 ขายหน้าร้าน</h2>
              <button onClick={() => setShowWalkin(false)} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>

            {/* Customer info */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ชื่อลูกค้า</div>
                <input value={walkinForm.customerName} onChange={e => setWalkinForm(f => ({ ...f, customerName: e.target.value }))} placeholder="ไม่ระบุได้"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>เบอร์โทร</div>
                <input value={walkinForm.customerPhone} onChange={e => setWalkinForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="ไม่ระบุได้" type="tel"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

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
            <button onClick={saveWalkin} disabled={walkinSaving} style={{
              width: "100%", padding: 13, borderRadius: 12, border: "none",
              background: "#10B981", color: WHITE, fontWeight: 800, fontSize: 15, cursor: "pointer",
              opacity: walkinSaving ? 0.6 : 1,
            }}>{walkinSaving ? "กำลังบันทึก..." : "✅ บันทึกการขาย"}</button>
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
            <p style={{ fontSize: 13, color: GRAY, marginBottom: 20 }}>ยอดรวม: <strong style={{ color: NAVY }}>฿{Number(walkinResult.order.total).toLocaleString()}</strong></p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setWalkinResult(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "2px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>ปิด</button>
              <button onClick={() => { printWalkinReceipt(walkinResult.order, walkinResult.walkinType, walkinResult.walkinForm); setWalkinResult(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>🖨 ปริ้นใบเสร็จ</button>
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

            {[
              ["ชื่อลูกค้า", "customerName", "text"],
              ["เบอร์โทร", "customerPhone", "tel"],
              ["ที่อยู่จัดส่ง *", "deliveryAddress", "text"],
              ["หมายเหตุ", "note", "text"],
            ].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{label}</div>
                <input type={type} value={createForm[key]} onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}

            {createForm.orderType === "gas" ? (
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ *</div>
                  <select value={createForm.brandId} onChange={e => setCreateForm(f => ({ ...f, brandId: e.target.value, productId: "" }))}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                    <option value="">-- เลือก --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก *</div>
                  <select value={createForm.productId} onChange={e => setCreateForm(f => ({ ...f, productId: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                    <option value="">-- เลือก --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ฿{Number(p.price).toLocaleString()}</option>
                    ))}
                  </select>
                </div>
              </div>
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
