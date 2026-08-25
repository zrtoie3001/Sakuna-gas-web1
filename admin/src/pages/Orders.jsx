import { useState, useEffect, useCallback, useRef } from "react";
import qrBase64 from "../assets/qrBase64.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../utils/api.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

// สยาม and ยูนิค share the same stock pool — find stock from either brand
const SHARED_BRANDS = ["ยูนิค", "สยาม"];
const ALL_WEIGHTS = [4, 7, 8, 11.5, 13.5, 15, 48];

function findStockByBrand(gasStocks, brandName, weight) {
  // Try exact match first, then partner brand if empty
  const exact = gasStocks.find(s => s.brandName === brandName && Number(s.weightKg) === Number(weight));
  if (exact) return exact;
  if (SHARED_BRANDS.includes(brandName)) {
    return gasStocks.find(s => SHARED_BRANDS.includes(s.brandName) && Number(s.weightKg) === Number(weight)) || null;
  }
  return null;
}

function sharedStockQty(gasStocks, brandName, weight, field) {
  if (SHARED_BRANDS.includes(brandName)) {
    return SHARED_BRANDS.reduce((sum, bn) => {
      const s = gasStocks.find(x => x.brandName === bn && Number(x.weightKg) === Number(weight));
      return sum + (Number(s?.[field]) || 0);
    }, 0);
  }
  const s = gasStocks.find(x => x.brandName === brandName && Number(x.weightKg) === Number(weight));
  return Number(s?.[field]) || 0;
}

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

function CustomerAutocomplete({ value, onChange, onSelect, placeholder, type = "text", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);

  function search(q) {
    if (disabled) return;
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
                  {c.unitPrice ? <span style={{ color: "#D97706", marginLeft: 6 }}>฿{Number(c.unitPrice).toLocaleString()}</span> : ""}
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
        onAdd({ equipId: item.id, name: item.name, qty, price: Number(price) });
        setId(""); setQty(1); setPrice("");
      }} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#10B981", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ เพิ่ม</button>
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [search, setSearch]         = useState(searchParams.get("q") || "");
  const [showWalkin, setShowWalkin] = useState(false);
  const [walkinType, setWalkinType] = useState("gas"); // gas | new_tank | equipment
  const [walkinForm, setWalkinForm] = useState({ customerName: "", customerPhone: "", brandName: "", productId: "", qty: 1, price: "", paymentMethod: "cash", note: "", gasBrand: "", gasWeight: "", stockId: "", equipId: "" });
  const [walkinSaving, setWalkinSaving] = useState(false);
  const [walkinResult, setWalkinResult] = useState(null); // { order, cart }
  const [walkinCart, setWalkinCart]     = useState([]); // cart items before save
  const [gasStocks, setGasStocks]   = useState([]);
  const [equipList, setEquipList]   = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [extraItems, setExtraItems] = useState({}); // { [orderId]: [{id, name, qty, price}] }
  const [createCart, setCreateCart]   = useState([]);
  const [createCustAddrs, setCreateCustAddrs] = useState([]); // addresses of selected customer in create modal
  const [createCustKnown, setCreateCustKnown] = useState(false); // true when customer selected from autocomplete
  const [custHistory, setCustHistory] = useState([]);
  const [historyKey, setHistoryKey] = useState(""); // phone|name used to fetch history
  const [hiddenHistKeys, setHiddenHistKeys] = useState(new Set()); // keys hidden by user for current customer
  const [historyQtyPicker, setHistoryQtyPicker] = useState(null); // { h, label } for qty picker popup
  const cartRef = useRef(null);
  const [editOrder, setEditOrder]     = useState(null);   // order being edited
  const [editForm,  setEditForm]      = useState({});
  const [editItems, setEditItems]     = useState(null);   // null = single-item mode, array = multi-item (walkin mixed)
  const [editSaving, setEditSaving]   = useState(false);
  const [showUnpaid, setShowUnpaid]   = useState(false);

  const fetchRef = useRef(null);
  const fetch = useCallback(async () => {
    if (fetchRef.current) fetchRef.current.abort();
    const ctrl = new AbortController();
    fetchRef.current = ctrl;
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set("status", statusFilter);
      if (date) params.set("date", date);
      const r = await api.get(`/api/v1/orders?${params}`, { signal: ctrl.signal });
      setOrders(r.data.orders);
      setTotal(r.data.total);
    } catch (e) {
      if (e.name !== "CanceledError" && e.code !== "ERR_CANCELED") console.error("fetch orders error:", e.message);
    }
  }, [page, statusFilter, date]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 120000);
    return () => { clearInterval(interval); fetchRef.current?.abort(); };
  }, [fetch]);

  useEffect(() => {
    api.get("/api/v1/products/brands").then(r => setBrands(Array.isArray(r.data) ? r.data : r.data.brands || [])).catch(() => {});
    api.get("/api/v1/products?limit=100").then(r => setProducts(Array.isArray(r.data) ? r.data : r.data.products || [])).catch(() => {});
    api.get("/api/v1/stock/gas").then(r => setGasStocks(r.data)).catch(() => {});
    api.get("/api/v1/stock/equipment").then(r => setEquipList(r.data)).catch(() => {});
    api.get("/api/v1/drivers?role=driver").then(r => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  // Fetch customer history — debounced 500ms, fires when phone/name/address settles
  useEffect(() => {
    const t = setTimeout(() => {
      const phone   = createForm.customerPhone?.trim();
      const rawName = createForm.customerName?.trim();
      const name    = (rawName && rawName !== "ลูกค้าหน้าร้าน") ? rawName : "";
      const address = createForm.deliveryAddress?.trim();
      const k = `${phone}|${name}|${address}`;
      if (k === historyKey) return;
      if (!phone && !name && !address) { setCustHistory([]); setHistoryKey(""); setHiddenHistKeys(new Set()); return; }
      setHistoryKey(k);
      setHiddenHistKeys(new Set());
      const params = new URLSearchParams();
      if (phone) params.set("phone", phone);
      else if (address) params.set("address", address);
      else if (name) params.set("name", name);
      else return;
      api.get(`/api/v1/orders/customer-history?${params}`)
        .then(r => setCustHistory(r.data || []))
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [createForm.customerPhone, createForm.customerName, createForm.deliveryAddress]);

  function addToCreateCart() {
    if (createForm.orderType === "new_tank") {
      const stock = findStockByBrand(gasStocks, createForm.ntBrand, createForm.ntWeight);
      if (!stock) return alert("กรุณาเลือกยี่ห้อและน้ำหนัก");
      if (!createForm.newTankPrice) return alert("กรุณาใส่ราคา");
      const ntDisplayName = createForm.ntBrand || stock.brandName;
      setCreateCart(c => [...c, {
        type: "new_tank",
        brandName: ntDisplayName,
        weightKg: stock.weightKg,
        stockId: stock.id,
        qty: Number(createForm.qty || 1),
        price: Number(createForm.newTankPrice),
        label: `ถังใหม่ ${ntDisplayName} ${stock.weightKg} กก.`,
      }]);
      setCreateForm(f => ({ ...f, ntBrand: "", ntWeight: "", newTankStockId: "", newTankPrice: "", qty: 1 }));
    } else if (createForm.orderType === "equipment") {
      const eq = equipList.find(e => e.id === createForm.equipId);
      if (!eq) return alert("กรุณาเลือกอะไหล่");
      if (!createForm.unitPrice) return alert("กรุณาใส่ราคา");
      const q = Number(createForm.qty || 1);
      if (q > eq.qty) return alert(`สต็อก ${eq.name} มีแค่ ${eq.qty} ชิ้น`);
      setCreateCart(c => [...c, {
        type: "equipment",
        equipId: eq.id,
        name: eq.name,
        qty: q,
        price: Number(createForm.unitPrice),
        label: eq.name,
      }]);
      setCreateForm(f => ({ ...f, equipId: "", unitPrice: "", qty: 1 }));
    } else {
      if (!createForm.brandId || !createForm.productId) return alert("กรุณาเลือกยี่ห้อและน้ำหนัก");
      if (!createForm.unitPrice) return alert("กรุณาใส่ราคา");
      const brand = brands.find(b => b.id === createForm.brandId);
      const prod = products.find(p => p.id === createForm.productId);
      setCreateCart(c => [...c, {
        type: "gas",
        brandId: createForm.brandId,
        productId: createForm.productId,
        brandName: brand?.name || "",
        productName: prod?.name || "",
        weightKg: prod?.kg != null ? Number(prod.kg) : undefined,
        qty: Number(createForm.qty || 1),
        price: Number(createForm.unitPrice),
        label: `${brand?.name || ""} ${prod?.name || ""}`,
      }]);
      setCreateForm(f => ({ ...f, brandId: "", productId: "", unitPrice: "", qty: 1 }));
    }
  }

  async function confirmCreateOrder() {
    if (createCart.length === 0) return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");
    setCreating(true);
    try {
      const cartItems = createCart.map(it => ({
        type: it.type,
        brandName: it.brandName,
        weightKg: it.weightKg,
        stockId: it.stockId,
        brandId: it.brandId,
        productId: it.productId,
        equipId: it.equipId,
        name: it.name,
        qty: it.qty,
        price: it.price,
        label: it.label,
      }));
      const res = await api.post("/api/v1/orders/walkin", {
        type: "mixed",
        cartItems,
        customerName: createForm.customerName,
        customerPhone: createForm.customerPhone,
        paymentMethod: createForm.paymentMethod,
        note: createForm.note,
        deliveryAddress: createForm.deliveryAddress,
        orderStatus: "pending",
      });
      setShowCreate(false);
      setCreateForm(EMPTY_ORDER);
      setCreateCart([]);
      await fetch();
      setSelected(res.data);
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
    finally { setCreating(false); }
  }

  function addToWalkinCart() {
    if (walkinType === "gas" || walkinType === "new_tank") {
      const stock = findStockByBrand(gasStocks, walkinForm.gasBrand, walkinForm.gasWeight);
      if (!stock) return alert("กรุณาเลือกยี่ห้อและน้ำหนัก");
      if (!walkinForm.price) return alert("กรุณาใส่ราคา");
      const prefix = walkinType === "new_tank" ? "🆕 ถังใหม่ " : "⛽ ";
      setWalkinCart(c => [...c, {
        type: walkinType,
        brandName: walkinForm.gasBrand,
        weightKg: stock.weightKg,
        stockId: stock.id,
        qty: Number(walkinForm.qty || 1),
        price: Number(walkinForm.price),
        label: `${prefix}${walkinForm.gasBrand} ${stock.weightKg} กก.`,
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

  async function printReceipt(o, extras = []) {
    // Refresh order to get brand/product relations
    if (!o.brand || !o.product) {
      try { const r = await api.get(`/api/v1/orders/${o.id}`); o = { ...r.data, ...o, brand: r.data.brand, product: r.data.product }; } catch {}
    }
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
    let itemsHtml = "";
    let total = Number(o.total);
    if (walkinData?.type === "mixed" && Array.isArray(walkinData.items) && walkinData.items.length) {
      // Cart order — render each item as its own row
      for (const it of walkinData.items) {
        const q = Number(it.qty) || 1;
        const p = Number(it.price || it.unitPrice) || 0;
        const name = it.type === "new_tank" ? `ถังใหม่ ${it.brandName} ${it.weightKg}กก.`
                   : it.type === "gas" ? `${it.brandName} ${it.weightKg}กก.`
                   : it.name || it.brandName || "สินค้า";
        const unit = it.type === "equipment" ? " ชิ้น" : " ถัง";
        itemsHtml += `<tr><td style="white-space:nowrap; font-size:13px;">${name}</td><td style="text-align:center; white-space:nowrap;">${q}${unit}</td><td style="text-align:right; white-space:nowrap;">${p.toLocaleString()}</td><td style="text-align:right; white-space:nowrap;">${(q*p).toLocaleString()}</td></tr>`;
      }
    } else {
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
      itemsHtml = `<tr><td>${productLabel || "-"}</td><td style="text-align:center;">${displayQty}${qtyUnit}</td><td style="text-align:right;">${Number(unitPrice).toLocaleString()}</td><td style="text-align:right;">${subtotal.toLocaleString()}</td></tr>`;
    }
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
    let total = Number(order.total);
    let itemsHtml = "";

    // Parse walkin note (mixed cart orders)
    let walkinData = null;
    if (order.note?.startsWith("__walkin:")) {
      try { walkinData = JSON.parse(order.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
    }

    if (walkinData?.type === "mixed" && Array.isArray(walkinData.items) && walkinData.items.length) {
      for (const it of walkinData.items) {
        const q = Number(it.qty) || 1;
        const p = Number(it.price || it.unitPrice) || 0;
        const name = it.type === "new_tank" ? `ถังใหม่ ${it.brandName} ${it.weightKg}กก.`
                   : it.type === "gas" ? `${it.brandName} ${it.weightKg}กก.`
                   : it.name || it.brandName || "สินค้า";
        const unit = it.type === "equipment" ? " ชิ้น" : " ถัง";
        itemsHtml += `<tr><td style="white-space:nowrap; font-size:13px;">${name}</td><td style="text-align:center; white-space:nowrap;">${q}${unit}</td><td style="text-align:right; white-space:nowrap;">${p.toLocaleString()}</td><td style="text-align:right; white-space:nowrap;">${(q*p).toLocaleString()}</td></tr>`;
      }
    } else {
      const subtotal = Number(order.total) + discount;
      const unitPrice = order.qty > 0 ? Math.round(subtotal / order.qty) : 0;
      itemsHtml = `<tr><td style="white-space:nowrap; font-size:13px;">${(order.brand?.name || "") + " " + (order.product?.name || "")}</td><td style="text-align:center; white-space:nowrap;">${order.qty} ถัง</td><td style="text-align:right; white-space:nowrap;">${unitPrice.toLocaleString()}</td><td style="text-align:right; white-space:nowrap;">${subtotal.toLocaleString()}</td></tr>`;
    }

    for (const ex of extras) {
      const lineTotal = Number(ex.price) * Number(ex.qty);
      total += lineTotal;
      itemsHtml += `<tr><td style="white-space:nowrap; font-size:13px;">${ex.name}</td><td style="text-align:center; white-space:nowrap;">${ex.qty} ชิ้น</td><td style="text-align:right; white-space:nowrap;">${Number(ex.price).toLocaleString()}</td><td style="text-align:right; white-space:nowrap;">${lineTotal.toLocaleString()}</td></tr>`;
    }
    if (discount > 0) {
      itemsHtml += `<tr><td colspan="3" style="font-size:13px; font-weight:800; color:#000;">ส่วนลด${order.discountCode ? ` (${order.discountCode})` : ""}</td><td style="text-align:right; font-weight:800; color:#000;">-${discount.toLocaleString()}</td></tr>`;
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
<div class="center" style="font-size:12px; font-weight:400; color:#000; margin-bottom:2px;">โทร 097-121-3054 | 092-631-4331 | 02-970-9385</div>
<div class="center" style="font-size:12px; font-weight:400; color:#000; margin-bottom:6px;">39 ซอยพหลโยธิน 48 แขวงท่าแร้ง เขตบางเขน กทม. 10220</div>
<table style="margin-bottom:4px;">
  <tr>
    <td colspan="2" style="font-size:12px; font-weight:400; padding-bottom:2px;">${order.orderNumber} &nbsp;|&nbsp; ${dateStr} &nbsp;|&nbsp; ${timeStr} น.</td>
  </tr>
</table>
<div class="solid"></div>
<table style="margin-bottom:8px;">
  <tr><td colspan="2" style="word-break:break-word; font-size:14px; font-weight:800; padding-bottom:3px;">📍 ${order.deliveryAddress || "-"}</td></tr>
  <tr>
    <td colspan="2" style="font-size:14px; font-weight:800; padding-bottom:3px;">ลูกค้า: ${(order.customerName && order.customerName !== "ลูกค้าหน้าร้าน") ? order.customerName : "-"}</td>
  </tr>
  <tr><td colspan="2" style="padding-top:4px; font-size:14px; font-weight:800;">📞 ${order.customerPhone || "-"}</td></tr>
</table>
<div class="dash"></div>
<table>
  <thead>
    <tr style="border-bottom:1.5px solid #000;">
      <th style="text-align:left; width:36%; font-size:14px; padding-right:4px;">รายการ</th>
      <th style="text-align:center; width:22%; font-size:14px; padding:0 4px;">จำนวน</th>
      <th style="text-align:right; width:20%; font-size:14px; padding:0 4px; white-space:nowrap;">ราคา/ชิ้น</th>
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
<div class="center" style="font-size:13px; font-weight:800; margin:6px 0 4px;">สแกนโอนเงิน</div>
<div class="center"><img src="${qrBase64}" style="width:34mm; height:34mm; object-fit:contain;" /></div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:4px;">สกุณา</div>
<div class="dash" style="margin-top:6px;"></div>
<div class="center" style="font-size:13px; font-weight:800; margin-top:4px;">ขอบคุณที่ใช้บริการค่ะ</div>
</body></html>`;
    // ใช้ iframe ซ่อนอยู่เพื่อปริ้นโดยไม่ต้องเปิดหน้าต่างใหม่
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
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
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPaid: data.isPaid, status: data.status ?? o.status } : o));
    if (selected?.id === orderId) setSelected(s => ({ ...s, isPaid: data.isPaid, status: data.status ?? s.status }));
  }

  function openEdit(order) {
    setEditOrder(order);
    const noteRaw = order.note || "";
    let walkinData = null;
    if (noteRaw.startsWith("__walkin:")) {
      try { walkinData = JSON.parse(noteRaw.replace(/^__walkin:/, "").split("\n")[0]); } catch {}
    }
    const extraNote = noteRaw.startsWith("__walkin:") ? noteRaw.split("\n").slice(1).join("\n").trim() : noteRaw;

    if (walkinData?.type === "mixed" && Array.isArray(walkinData.items) && walkinData.items.length > 0) {
      // Multi-item walkin: edit each line separately
      setEditItems(walkinData.items.map(it => ({ ...it })));
    } else {
      setEditItems(null);
    }
    setEditForm({
      customerName:    order.customerName    || "",
      customerPhone:   order.customerPhone   || "",
      deliveryAddress: order.deliveryAddress || "",
      qty:             order.qty             ?? 1,
      unitPrice:       order.unitPrice       ?? order.total ?? 0,
      total:           order.total           ?? 0,
      paymentMethod:   order.paymentMethod   || "cash",
      brandId:         order.brandId         || order.brand?.id || "",
      productId:       order.productId       || order.product?.id || "",
      note:            extraNote,
      _walkinData:     walkinData,
    });
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      let qty, unitPrice, total, noteOut;
      if (editItems) {
        // Rebuild walkin note JSON from edited items
        const newWalkinData = { ...editForm._walkinData, items: editItems };
        const itemsTotal = editItems.reduce((s, it) => s + Number(it.qty || 1) * Number(it.price || it.unitPrice || 0), 0);
        qty = editItems.reduce((s, it) => s + Number(it.qty || 1), 0);
        unitPrice = qty > 0 ? Math.round(itemsTotal / qty) : 0;
        total = itemsTotal;
        noteOut = `__walkin:${JSON.stringify(newWalkinData)}${editForm.note ? "\n" + editForm.note : ""}`;
      } else {
        qty = Number(editForm.qty || 1);
        unitPrice = Number(editForm.unitPrice || 0);
        total = qty * unitPrice;
        noteOut = editForm.note;
      }
      const payload = {
        customerName:    editForm.customerName,
        customerPhone:   editForm.customerPhone,
        deliveryAddress: editForm.deliveryAddress,
        qty,
        unitPrice,
        total,
        paymentMethod: editForm.paymentMethod,
        brandId:   editForm.brandId   || null,
        productId: editForm.productId || null,
        note: noteOut,
      };
      const { data: updated } = await api.put(`/api/v1/orders/${editOrder.id}`, payload);
      const brandObj = brands.find(b => String(b.id) === String(editForm.brandId));
      const prodObj  = products.find(p => String(p.id) === String(editForm.productId));
      const merged = { ...updated, brand: brandObj || null, product: prodObj || null };
      setSelected(s => s?.id === editOrder.id ? { ...s, ...merged } : s);
      setOrders(prev => prev.map(o => o.id === editOrder.id ? { ...o, ...merged } : o));
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
          <button onClick={() => { setStatus("pending"); setDate(""); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #F59E0B", background: statusFilter === "pending" && !date ? "#FEF3C7" : WHITE, color: "#92400E", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            รอดำเนินการ ทั้งวัน
          </button>
        </div>

        {/* Unpaid alert */}
        {(() => {
          const unpaid = orders.filter(o => !o.isPaid && o.status !== "cancelled");
          if (!unpaid.length) return null;
          return (
            <div style={{ background: "#FEF3C7", border: "1.5px solid #FCD34D", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span onClick={() => setShowUnpaid(v => !v)} style={{ fontSize: 13, fontWeight: 700, color: "#92400E", cursor: "pointer" }}>⚠️ ยังค้างเงิน {unpaid.length} ออเดอร์</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <span onClick={() => setShowUnpaid(v => !v)} style={{ fontSize: 12, color: "#92400E", cursor: "pointer" }}>{showUnpaid ? "▲ ซ่อน" : "▼ ดูรายการ"}</span>
                  <span onClick={() => navigate("/debts")} style={{ fontSize: 12, fontWeight: 700, color: "#B45309", cursor: "pointer", textDecoration: "underline" }}>💸 ไปหน้าค้างเงิน</span>
                </div>
              </div>
              {showUnpaid && (
                <div style={{ borderTop: "1px solid #FCD34D", padding: "8px 14px 12px" }}>
                  {unpaid.map(o => (
                    <div key={o.id} onClick={() => { setSelected(o); setShowUnpaid(false); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #FDE68A", cursor: "pointer" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>{o.orderNumber}</span>
                        <span style={{ fontSize: 12, color: "#78350F", marginLeft: 8 }}>{o.customerName}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#B45309" }}>฿{Number(o.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Pagination top */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY, cursor: page === 1 ? "default" : "pointer" }}>←</button>
          <span style={{ padding: "6px 10px", fontSize: 13, color: GRAY }}>หน้า {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            style={{ padding: "6px 14px", borderRadius: 8, border: "2px solid #E5E7EB", background: WHITE, fontWeight: 700, color: NAVY, cursor: orders.length < 20 ? "default" : "pointer" }}>→</button>
        </div>

        {/* Table */}
        <div style={{ background: WHITE, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          {orders.filter(o => !search || [o.orderNumber, o.customerName, o.customerPhone, o.deliveryAddress, o.product?.name].some(v => String(v||"").toLowerCase().includes(search.toLowerCase()))).map(o => {
            const s = st(o.status);
            const isCancelled = o.status === "cancelled";
            return (
              <div key={o.id} onClick={() => setSelected(o)} style={{
                padding: "12px 16px", borderBottom: "1px solid #F3F4F6",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                background: isCancelled ? "#FFF5F5" : selected?.id === o.id ? "#EEF2FF" : WHITE,
                opacity: isCancelled ? 0.7 : 1,
                transition: "background .1s",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isCancelled ? "#9CA3AF" : ORANGE, textDecoration: isCancelled ? "line-through" : "none" }}>{o.orderNumber}</span>
                    <span style={{ fontSize: 11, background: s.bg, color: s.color, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{s.label}</span>
                    {!isCancelled && <span onClick={e => { e.stopPropagation(); togglePaid(o.id); }} style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 6, fontWeight: 700, cursor: "pointer",
                      background: o.isPaid ? "#D1FAE5" : "#FEE2E2",
                      color: o.isPaid ? "#065F46" : "#991B1B",
                    }}>{o.isPaid ? "✅ จ่ายแล้ว" : "⏳ ยังไม่จ่าย"}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: isCancelled ? GRAY : NAVY }}>{o.customerName} · {o.customerPhone}</p>
                  <p style={{ fontSize: 12, color: GRAY, textDecoration: isCancelled ? "line-through" : "none" }}>{(() => {
                    let wd = null;
                    if (o.note?.startsWith("__walkin:")) { try { wd = JSON.parse(o.note.replace(/^__walkin:/, "").split("\n")[0]); } catch {} }
                    if (wd?.type === "mixed") return (wd.items || []).map(i => i.brandName || i.name).filter(Boolean).join(", ") || "หลายรายการ";
                    if (wd?.brandName && wd?.weightKg) return `${wd.brandName} ${wd.weightKg}กก. ×${wd.qty || o.qty}`;
                    return `${o.brand?.name || ""} ${o.product?.name || ""}`.trim() || "-";
                  })()} · ฿{Number(o.total).toLocaleString()}</p>
                  {o.deliveryAddress && <p style={{ fontSize: 11, color: "#6B7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {o.deliveryAddress}</p>}
                  {o.driver && <p style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>🛵 {o.driver.name}</p>}
                </div>
                <div style={{ fontSize: 11, color: GRAY, textAlign: "right", flexShrink: 0 }}>
                  {!date && <div>{new Date(o.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>}
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
              <button onClick={async () => {
                const ex = extraItems[selected.id] || [];
                if (ex.length) {
                  try {
                    await api.post(`/api/v1/orders/${selected.id}/extras`, { items: ex });
                    setExtraItems(prev => ({ ...prev, [selected.id]: [] }));
                    fetch();
                  } catch (e) {
                    return alert("บันทึกไม่สำเร็จ: " + (e.response?.data?.error || e.message));
                  }
                  printReceiptWithExtras(selected, ex);
                } else {
                  printReceipt(selected);
                }
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
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
              <span style={{ color: GRAY, flexShrink: 0, width: 80 }}>{k}</span>
              <span style={{ color: NAVY, wordBreak: "break-word" }}>{v || "-"}</span>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13, alignItems: "center" }}>
            <span style={{ color: GRAY, flexShrink: 0, width: 80 }}>🛵 คนส่ง</span>
            <select value={selected.driverId || ""} onChange={async e => {
              const driverId = e.target.value || null;
              await api.put(`/api/v1/orders/${selected.id}/driver`, { driverId });
              setSelected(s => ({ ...s, driverId, driver: drivers.find(d => d.id === driverId) || null }));
              fetch();
            }} style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 13, color: NAVY }}>
              <option value="">-- ยังไม่มีคนรับงาน --</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {(() => {
            const n = selected.note || "";
            if (n.startsWith("__walkin:")) {
              // show cart items in human-readable form
              let walkinItems = null;
              try {
                const data = JSON.parse(n.replace(/^__walkin:/, "").split("\n")[0]);
                walkinItems = data.items || (data.type !== "mixed" ? [data] : null);
              } catch {}
              const userNote = n.split("\n").slice(1).join("\n").trim();
              return (
                <>
                  {walkinItems && (
                    <div style={{ marginTop: 10, background: "#F0FDF4", borderRadius: 8, padding: 10, fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: "#166534", marginBottom: 6 }}>🛒 รายการสินค้า</div>
                      {walkinItems.map((it, i) => (
                        <div key={i} style={{ color: "#1F2937", padding: "3px 0", borderBottom: i < walkinItems.length-1 ? "1px solid #D1FAE5" : "none" }}>
                          {it.label || it.name || `${it.brandName || ""} ${it.weightKg ? it.weightKg+"กก." : ""}`.trim()}
                          {" · "}{it.qty} {it.type === "equipment" ? "ชิ้น" : "ถัง"}
                          {it.price ? ` · ฿${Number(it.price).toLocaleString()}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                  {userNote && (
                    <div style={{ marginTop: 8, background: "#FFF7ED", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E" }}>
                      💬 {userNote}
                    </div>
                  )}
                </>
              );
            }
            return n ? (
              <div style={{ marginTop: 10, background: "#FFF7ED", borderRadius: 8, padding: 10, fontSize: 12, color: "#92400E" }}>
                💬 {n}
              </div>
            ) : null;
          })()}

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
            {selected.status !== "cancelled" && (
              <button onClick={() => {
                if (!window.confirm(`ยืนยันยกเลิกออเดอร์ ${selected.orderNumber}?`)) return;
                updateStatus(selected.id, "cancelled");
              }} disabled={updating} style={{
                marginTop: 10, width: "100%", padding: "7px", borderRadius: 8, border: "2px solid #EF4444",
                background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer",
                opacity: updating ? 0.6 : 1,
              }}>🚫 ยกเลิกออเดอร์</button>
            )}
            {selected.status === "cancelled" && (
              <div style={{ marginTop: 10, padding: "7px 12px", borderRadius: 8, background: "#FEE2E2", color: "#991B1B", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                ❌ ออเดอร์ถูกยกเลิกแล้ว
              </div>
            )}
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

            {editItems ? (
              // ── Multi-item walkin: show each line editable ──
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 8 }}>รายการสินค้า</div>
                {editItems.map((it, idx) => {
                  const label = it.type === "new_tank" ? `ถังใหม่ ${it.brandName} ${it.weightKg}กก.`
                              : it.type === "gas"      ? `${it.brandName} ${it.weightKg}กก.`
                              : it.name || it.brandName || "สินค้า";
                  const lineTotal = Number(it.qty || 1) * Number(it.price || it.unitPrice || 0);
                  return (
                    <div key={idx} style={{ background: "#F8FAFF", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1.5px solid #E5E7EB" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>รายการที่ {idx + 1}: {label}</div>
                      {(() => {
                        const allBrands = [...new Set([...brands.map(b => b.name), ...gasStocks.map(s => s.brandName)])].sort();
                        const allWeights = [...new Set([...ALL_WEIGHTS, ...gasStocks.filter(s => !it.brandName || s.brandName === it.brandName || (SHARED_BRANDS.includes(it.brandName) && SHARED_BRANDS.includes(s.brandName))).map(s => Number(s.weightKg))])].sort((a,b)=>a-b);
                        return (
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, marginBottom: 3 }}>ยี่ห้อ</div>
                              <select value={it.brandName || ""} onChange={e => setEditItems(arr => arr.map((x, i) => i === idx ? { ...x, brandName: e.target.value } : x))}
                                style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}>
                                <option value="">-- ยี่ห้อ --</option>
                                {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            {(it.type === "gas" || it.type === "new_tank") && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, marginBottom: 3 }}>น้ำหนัก (กก.)</div>
                                <select value={it.weightKg || ""} onChange={e => setEditItems(arr => arr.map((x, i) => i === idx ? { ...x, weightKg: e.target.value } : x))}
                                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }}>
                                  <option value="">-- กก. --</option>
                                  {allWeights.map(w => <option key={w} value={w}>{w} กก.</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, marginBottom: 3 }}>จำนวน</div>
                          <input type="number" min="1" value={it.qty || ""} onChange={e => setEditItems(arr => arr.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, marginBottom: 3 }}>ราคา/ถัง (บาท)</div>
                          <input type="number" value={it.price || it.unitPrice || ""} onChange={e => setEditItems(arr => arr.map((x, i) => i === idx ? { ...x, price: e.target.value, unitPrice: e.target.value } : x))}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.5px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                          <div style={{ fontSize: 10, color: GRAY, fontWeight: 700, marginBottom: 3 }}>รวม</div>
                          <div style={{ padding: "7px 10px", fontWeight: 800, color: "#059669", fontSize: 13 }}>฿{lineTotal.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#166534", fontSize: 13 }}>ยอดรวม</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>
                    ฿{editItems.reduce((s, it) => s + Number(it.qty || 1) * Number(it.price || it.unitPrice || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              // ── Single item ──
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ</div>
                    <select value={editForm.brandId || ""} onChange={e => setEditForm(f => ({ ...f, brandId: e.target.value, productId: "" }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                      <option value="">-- ยี่ห้อ --</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก</div>
                    <select value={editForm.productId || ""} onChange={e => setEditForm(f => ({ ...f, productId: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                      <option value="">-- น้ำหนัก --</option>
                      {products.filter(p => !editForm.brandId || p.brandId === editForm.brandId || p.brand_id === editForm.brandId).map(p => (
                        <option key={p.id} value={p.id}>{p.kg != null ? `${p.kg} กก.` : p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

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
              </>
            )}

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
              <button onClick={() => { setShowWalkin(false); setWalkinCart([]); setWalkinForm({ customerName: "", customerPhone: "", brandName: "", productId: "", qty: 1, price: "", paymentMethod: "cash", note: "", gasBrand: "", gasWeight: "", stockId: "", equipId: "" }); setWalkinType("gas"); }} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
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
              // Use brands from API; add any gasStock brands not already covered
              const stockBrandNames = [...new Set(gasStocks.map(s => s.brandName))];
              const apiBrandNames = brands.map(b => b.name);
              const allBrandNames = [...new Set([...apiBrandNames, ...stockBrandNames])].sort();
              const stockWeights = gasStocks.filter(s => !walkinForm.gasBrand || s.brandName === walkinForm.gasBrand || (SHARED_BRANDS.includes(walkinForm.gasBrand) && SHARED_BRANDS.includes(s.brandName))).map(s => Number(s.weightKg));
              const weights = [...new Set([...ALL_WEIGHTS, ...stockWeights])].sort((a,b)=>a-b);
              const selectedStock = findStockByBrand(gasStocks, walkinForm.gasBrand, walkinForm.gasWeight);
              const stockField = walkinType === "new_tank" ? "newTank" : "hasGas";
              const stockQty = walkinForm.gasBrand && walkinForm.gasWeight ? sharedStockQty(gasStocks, walkinForm.gasBrand, walkinForm.gasWeight, stockField) : null;
              const stockLabel = walkinType === "new_tank" ? "ถังใหม่" : "ถังมีแก๊ส";
              return (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ยี่ห้อ *</div>
                      <select value={walkinForm.gasBrand || ""} onChange={e => setWalkinForm(f => ({ ...f, gasBrand: e.target.value, gasWeight: "", stockId: "" }))}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือกยี่ห้อ --</option>
                        {allBrandNames.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>น้ำหนัก *</div>
                      <select value={walkinForm.gasWeight || ""} onChange={e => {
                        const w = e.target.value;
                        const s = findStockByBrand(gasStocks, walkinForm.gasBrand, w);
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
          <div style={{ background: WHITE, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, margin: "auto", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>📞 เพิ่มออเดอร์ (ลูกค้าโทรสั่ง)</h2>
              <button onClick={() => { setShowCreate(false); setCreateCart([]); setCreateForm(EMPTY_ORDER); setCreateCustKnown(false); setCreateCustAddrs([]); setCustHistory([]); setHistoryKey(""); }} style={{ background: "none", border: "none", fontSize: 20, color: GRAY, cursor: "pointer" }}>✕</button>
            </div>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["gas","⛽ ถังแก๊ส"],["new_tank","🆕 ถังใหม่"],["equipment","🔧 อะไหล่"]].map(([k, label]) => (
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
                onChange={v => { setCreateForm(f => ({ ...f, customerName: v })); setCreateCustKnown(false); setCreateCustAddrs([]); setCustHistory([]); }}
                onSelect={c => {
                  setCreateCustKnown(true);
                  setCreateCustAddrs(c.addresses || []);
                  setCreateForm(f => ({
                    ...f,
                    customerName:    c.customerName || "",
                    customerPhone:   c.customerPhone || f.customerPhone || "",
                    deliveryAddress: f.deliveryAddress || c.addresses?.[0] || c.deliveryAddress || "",
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                    unitPrice: c.unitPrice ? String(c.unitPrice) : f.unitPrice,
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
                  setCreateCustKnown(true);
                  setCreateCustAddrs(c.addresses || []);
                  const incomingName2 = (c.customerName && c.customerName !== "ลูกค้าหน้าร้าน") ? c.customerName : "";
                  setCreateForm(f => ({
                    ...f,
                    customerName:    f.customerName    || incomingName2,
                    customerPhone:   c.customerPhone   || "",
                    deliveryAddress: f.deliveryAddress || c.addresses?.[0] || c.deliveryAddress || "",
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                    unitPrice: c.unitPrice ? String(c.unitPrice) : f.unitPrice,
                  }));
                }}
                placeholder="ไม่ระบุได้"
                disabled={!createCustKnown}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ที่อยู่จัดส่ง</div>
              <CustomerAutocomplete
                value={createForm.deliveryAddress}
                onChange={v => setCreateForm(f => ({ ...f, deliveryAddress: v }))}
                onSelect={c => {
                  setCreateCustAddrs(c.addresses || []);
                  const incomingName = (c.customerName && c.customerName !== "ลูกค้าหน้าร้าน") ? c.customerName : "";
                  setCreateForm(f => ({
                    ...f,
                    customerName:    f.customerName    || incomingName,
                    customerPhone:   f.customerPhone   || c.customerPhone || "",
                    deliveryAddress: c.addresses?.[0]  || c.deliveryAddress || f.deliveryAddress,
                    brandId:   f.brandId   || c.brandId   || "",
                    productId: f.productId || c.productId || "",
                    unitPrice: c.unitPrice ? String(c.unitPrice) : f.unitPrice,
                  }));
                }}
                placeholder="บ้านเลขที่ ซอย..."
              />
              {createCustAddrs.length > 1 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {createCustAddrs.map((addr, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => setCreateForm(f => ({ ...f, deliveryAddress: addr }))}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "2px solid #E5E7EB", background: "#F9FAFB", textAlign: "left", fontSize: 12, color: NAVY, cursor: "pointer" }}>
                        📍 {addr}
                      </button>
                      <button onClick={() => setCreateCustAddrs(a => a.filter((_, j) => j !== i))}
                        style={{ padding: "5px 8px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: WHITE, color: GRAY, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {custHistory.length > 0 && (
              <div style={{ marginBottom: 14, background: "#F0F9FF", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginBottom: 8 }}>⏱ ประวัติการสั่งซื้อ — กดเพื่อเพิ่มลงตะกร้า</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {custHistory.filter(h => {
                    const hk = `${h.type}|${h.brandName}|${h.weightKg}|${Math.round(h.unitPrice)}`;
                    return !hiddenHistKeys.has(hk);
                  }).map((h, i) => {
                    const hk = `${h.type}|${h.brandName}|${h.weightKg}|${Math.round(h.unitPrice)}`;
                    const label = h.type === "new_tank"
                      ? `🆕 ถังใหม่ ${h.brandName} ${h.weightKg}กก.`
                      : `⛽ ${h.brandName} ${h.weightKg ? h.weightKg + "กก." : ""}`;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: WHITE, borderRadius: 8, padding: "8px 10px", border: "1.5px solid #BAE6FD" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{label}</span>
                          <span style={{ fontSize: 12, color: ORANGE, fontWeight: 700, marginLeft: 8 }}>฿{Number(h.unitPrice).toLocaleString()}</span>
                          {h.count > 1 && <span style={{ fontSize: 11, color: GRAY, marginLeft: 6 }}>({h.count} ครั้ง)</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setHistoryQtyPicker({ h, label, hk })}
                            style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: NAVY, color: WHITE, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ เพิ่ม</button>
                          <button onClick={() => setHiddenHistKeys(s => new Set([...s, hk]))}
                            style={{ padding: "5px 8px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: WHITE, color: GRAY, fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
              const ntBrands = [...new Set([...brands.map(b => b.name), ...gasStocks.map(s => s.brandName)])].sort();
              const ntWeights = [...new Set([...ALL_WEIGHTS, ...gasStocks.filter(s => !createForm.ntBrand || s.brandName === createForm.ntBrand || (SHARED_BRANDS.includes(createForm.ntBrand) && SHARED_BRANDS.includes(s.brandName))).map(s => Number(s.weightKg))])].sort((a,b)=>a-b);
              const ntStock = findStockByBrand(gasStocks, createForm.ntBrand, createForm.ntWeight);
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
                        const s = findStockByBrand(gasStocks, createForm.ntBrand, w);
                        setCreateForm(f => ({ ...f, ntWeight: w, newTankStockId: s?.id || "" }));
                      }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                        <option value="">-- เลือก --</option>
                        {ntWeights.map(w => <option key={w} value={w}>{w} กก.</option>)}
                      </select>
                    </div>
                  </div>
                  {ntStock && createForm.ntBrand && createForm.ntWeight && (
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#166534" }}>
                      ถังใหม่ในสต็อก: <strong>{sharedStockQty(gasStocks, createForm.ntBrand, createForm.ntWeight, "newTank")} ถัง</strong>
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

            {createForm.orderType === "equipment" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>อะไหล่ *</div>
                <select value={createForm.equipId || ""} onChange={e => {
                  const eq = equipList.find(x => x.id === e.target.value);
                  setCreateForm(f => ({ ...f, equipId: e.target.value, unitPrice: eq?.price ? String(eq.price) : f.unitPrice }));
                }} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }}>
                  <option value="">-- เลือกอะไหล่ --</option>
                  {equipList.map(eq => <option key={eq.id} value={eq.id}>{eq.name} (มี {eq.qty} ชิ้น)</option>)}
                </select>
                {createForm.equipId && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>ราคา (บาท) *</div>
                    <input type="number" value={createForm.unitPrice || ""} onChange={e => setCreateForm(f => ({ ...f, unitPrice: e.target.value }))}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 4 }}>{createForm.orderType === "equipment" ? "จำนวน (ชิ้น)" : "จำนวน (ถัง)"}</div>
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

            {/* Add to cart */}
            <button onClick={addToCreateCart} style={{
              width: "100%", padding: 11, borderRadius: 10, border: "none",
              background: ORANGE, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 14,
            }}>➕ เพิ่มใส่ตะกร้า</button>

            {/* Cart */}
            {createCart.length > 0 && (
              <div ref={cartRef} style={{ background: "#F8FAFC", border: "2px solid #E5E7EB", borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🛒 ตะกร้าสินค้า</div>
                {createCart.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: idx < createCart.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{it.label}</div>
                      <div style={{ fontSize: 12, color: GRAY }}>x{it.qty} × ฿{Number(it.price).toLocaleString()} = <strong>฿{(it.qty * it.price).toLocaleString()}</strong></div>
                    </div>
                    <button onClick={() => setCreateCart(c => c.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#EF4444", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "2px solid #D1D5DB" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>รวมทั้งสิ้น</span>
                  <span style={{ fontWeight: 900, fontSize: 16, color: "#059669" }}>฿{createCart.reduce((s, i) => s + i.qty * i.price, 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            <button onClick={confirmCreateOrder} disabled={creating || createCart.length === 0} style={{
              width: "100%", padding: 13, borderRadius: 12, border: "none",
              background: createCart.length === 0 ? "#9CA3AF" : "#10B981",
              color: WHITE, fontWeight: 800, fontSize: 15,
              cursor: createCart.length === 0 ? "not-allowed" : "pointer",
              opacity: creating ? 0.6 : 1,
            }}>
              {creating ? "กำลังสร้าง..." : `✅ ยืนยันออเดอร์${createCart.length > 0 ? ` (${createCart.length} รายการ)` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* History qty picker */}
      {historyQtyPicker && (() => {
        const { h, label } = historyQtyPicker;
        let pickerQty = 1;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: WHITE, borderRadius: 18, padding: 24, width: "100%", maxWidth: 320 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: ORANGE, fontWeight: 700, marginBottom: 16 }}>฿{Number(h.unitPrice).toLocaleString()} / ถัง</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 6 }}>จำนวน (ถัง)</div>
              <input id="hist-qty-input" type="number" min="1" defaultValue={1}
                onChange={e => { pickerQty = Math.max(1, parseInt(e.target.value) || 1); }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 20, fontWeight: 800, textAlign: "center", boxSizing: "border-box", marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setHistoryQtyPicker(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "2px solid #E5E7EB", background: WHITE, color: GRAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
                <button onClick={() => {
                  const qty = Math.max(1, parseInt(document.getElementById("hist-qty-input")?.value) || 1);
                  const stock = gasStocks.find(s => s.brandName === h.brandName && Number(s.weightKg) === Number(h.weightKg));
                  if (h.type === "new_tank") {
                    setCreateCart(c => [...c, { type: "new_tank", stockId: stock?.id, brandName: h.brandName, weightKg: h.weightKg, label, qty, price: h.unitPrice, equipId: null, name: label }]);
                  } else {
                    const brand = brands.find(b => b.name === h.brandName);
                    const prod = products.find(p => Number(p.kg) === Number(h.weightKg));
                    setCreateCart(c => [...c, { type: "gas", brandId: brand?.id, productId: prod?.id, brandName: h.brandName, weightKg: h.weightKg, label, qty, price: h.unitPrice, equipId: null, name: label }]);
                  }
                  setHistoryQtyPicker(null);
                  setTimeout(() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                }} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>✅ เพิ่มลงตะกร้า</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
