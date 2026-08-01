import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, createContext, useRef, useEffect, useMemo } from "react";

export const SearchContext = createContext({ q: "", setQ: () => {} });
import api from "../utils/api.js";

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function unlockAudio() {
  try { getAudioCtx(); } catch {}
}

function isSoundEnabled() {
  return localStorage.getItem("admin_sound") !== "off";
}

function playBeep(type = "new") {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const sequences = type === "new"
      ? [
          { f: 1047, t: 0,    d: 0.12, wave: "square", vol: 0.3 },
          { f: 1047, t: 0.18, d: 0.12, wave: "square", vol: 0.3 },
          { f: 1047, t: 0.36, d: 0.12, wave: "square", vol: 0.3 },
          { f: 1397, t: 0.54, d: 0.3,  wave: "square", vol: 0.35 },
        ]
      : [
          { f: 659,  t: 0,    d: 0.15, wave: "sine", vol: 0.3 },
          { f: 880,  t: 0.2,  d: 0.25, wave: "sine", vol: 0.3 },
        ];
    sequences.forEach(({ f, t, d, wave, vol }) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = wave;
      g.gain.setValueAtTime(vol, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch {}
}

function showNotif(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/images/Logo Sanuka.png", tag: "order-alert", renotify: true });
    } catch {}
  }
}

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";

const NAV = [
  { to: "/",          icon: "📊", label: "Dashboard" },
  { to: "/orders",    icon: "📦", label: "ออเดอร์" },
  { to: "/products",  icon: "🛢", label: "สินค้า" },
  { to: "/discounts", icon: "🎟", label: "โค้ดส่วนลด" },
  { to: "/drivers",   icon: "🛵", label: "พนักงาน",      roles: ["finance"] },
  { to: "/customers", icon: "👥", label: "ลูกค้า" },
  { to: "/reports",   icon: "📈", label: "รายงาน" },
  { to: "/stock",     icon: "📦", label: "สต็อก" },
  { to: "/debts",     icon: "💸", label: "ค้างเงิน/ถัง" },
  { to: "/expenses",  icon: "🧾", label: "เบิกเงิน" },
  { to: "/finance",   icon: "💼", label: "การเงิน",      roles: ["finance"] },
  { to: "/settings",  icon: "⚙️", label: "ตั้งค่า" },
];

// Sidebar แยกออกมาเป็น module-level component เพื่อไม่ให้ React remount ทุก render
function Sidebar({ user, onClose, mobile, onPasswordClick, onLogout }) {
  const visibleNav = useMemo(
    () => NAV.filter(item => !item.roles || item.roles.includes(user.role)),
    [user.role]
  );
  return (
    <div style={{
      width: mobile ? "100%" : 220, flexShrink: 0,
      background: `linear-gradient(180deg, ${NAVY2} 0%, ${NAVY} 100%)`,
      display: "flex", flexDirection: "column",
      height: mobile ? "auto" : "100vh",
      position: mobile ? "relative" : "sticky", top: 0,
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: WHITE }}>
          🔥 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 3 }}>Admin Panel</div>
      </div>

      <nav style={{ flex: 1, padding: "12px 0" }}>
        {visibleNav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={onClose}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 20px", fontSize: 14, fontWeight: isActive ? 800 : 400,
              color: isActive ? WHITE : "rgba(255,255,255,.6)",
              background: isActive ? "rgba(244,123,32,.25)" : "transparent",
              borderLeft: isActive ? `3px solid ${ORANGE}` : "3px solid transparent",
              transition: "all .15s",
            })}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginBottom: 10 }}>
          👤 {user.name || "Admin"}
        </div>
        <button onClick={onPasswordClick} style={{
          width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
          background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer", marginBottom: 6,
        }}>
          🔑 เปลี่ยนรหัสผ่าน
        </button>
        <button onClick={onLogout} style={{
          width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
          background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer",
        }}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const navigate  = useNavigate();
  const user      = useMemo(() => JSON.parse(localStorage.getItem("admin_user") || "{}"), []);
  const [sideOpen, setSideOpen] = useState(false);
  const [pwModal, setPwModal]   = useState(false);
  const [pwForm, setPwForm]     = useState({ next: "", confirm: "" });
  const [globalQ, setGlobalQ]   = useState("");
  const [notifDenied, setNotifDenied] = useState(
    "Notification" in window && Notification.permission === "default"
  );
  const knownOrders = useRef(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(p => { if (p === "granted") setNotifDenied(false); });
    }

    let cancelled = false;

    async function checkOrders() {
      try {
        const r = await api.get("/api/v1/orders?limit=50");
        if (cancelled) return;
        const orders = r.data.orders || [];
        if (knownOrders.current === null) {
          knownOrders.current = new Map(orders.map(o => [o.id, o.status]));
          return;
        }
        orders.forEach(o => {
          if (!knownOrders.current.has(o.id)) {
            playBeep("new");
            showNotif("🔥 ออเดอร์ใหม่!", `${o.customerName || "ลูกค้า"} · ${o.product?.name || ""} ฿${Number(o.total).toLocaleString()}`);
          } else if (knownOrders.current.get(o.id) !== o.status) {
            if (o.status === "delivered") {
              playBeep("update");
              showNotif("✅ ส่งสำเร็จ", `${o.orderNumber} · ${o.customerName || ""}`);
            } else if (o.status === "out_for_delivery") {
              playBeep("update");
              showNotif("🛵 กำลังส่ง", `${o.orderNumber} · ${o.driver?.name || ""}`);
            }
          }
          knownOrders.current.set(o.id, o.status);
        });
      } catch {}
    }

    const id = setInterval(checkOrders, 15000);
    checkOrders();
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function changeMyPassword() {
    if (pwForm.next.length < 6) return alert("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว");
    if (pwForm.next !== pwForm.confirm) return alert("รหัสผ่านใหม่ไม่ตรงกัน");
    try {
      await api.put(`/api/v1/drivers/${user.id}`, { password: pwForm.next });
      alert("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      setPwModal(false); setPwForm({ next: "", confirm: "" });
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  function logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }} onClick={unlockAudio}>
      {/* Desktop sidebar */}
      <div style={{ display: "none" }} className="desktop-sidebar">
        <Sidebar user={user} onClose={() => {}} onPasswordClick={() => setPwModal(true)} onLogout={logout} />
      </div>

      {/* Mobile sidebar overlay */}
      {sideOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div style={{ width: 240 }}>
            <Sidebar user={user} mobile onClose={() => setSideOpen(false)} onPasswordClick={() => { setSideOpen(false); setPwModal(true); }} onLogout={logout} />
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,.5)" }} onClick={() => setSideOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          background: WHITE, padding: "14px 20px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", gap: 12,
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: "none", border: "none", fontSize: 20, color: NAVY, cursor: "pointer" }}>☰</button>
          <span style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
            🔥 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
          </span>
          <input
            placeholder="🔍 ค้นหา..."
            value={globalQ}
            onChange={e => setGlobalQ(e.target.value)}
            style={{ flex: 1, maxWidth: 220, padding: "7px 12px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 13, outline: "none" }}
          />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>
            Admin: {user.name}
          </span>
        </div>

        {/* Notification permission banner */}
        {notifDenied && (
          <div style={{ background: "#FEF3C7", borderBottom: "1px solid #FCD34D", padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span>🔔 เปิดการแจ้งเตือนเพื่อรับแจ้งเตือนออเดอร์แม้ไม่ได้อยู่หน้าเว็บ</span>
            <button onClick={() => Notification.requestPermission().then(p => { if (p === "granted") setNotifDenied(false); })}
              style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#F59E0B", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              อนุญาต
            </button>
            <button onClick={() => setNotifDenied(false)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 16, color: "#92400E", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <SearchContext.Provider value={{ q: globalQ, setQ: setGlobalQ }}>
            <Outlet />
          </SearchContext.Provider>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: block !important; }
        }
      `}</style>

      {/* Change password modal */}
      {pwModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>🔑 เปลี่ยนรหัสผ่าน</h2>
              <button onClick={() => setPwModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#6B7280" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>บัญชี: <strong style={{ color: NAVY }}>{user.name}</strong></p>
            {[["รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)", "next"], ["ยืนยันรหัสผ่านใหม่", "confirm"]].map(([label, key]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 4, fontWeight: 700 }}>{label}</label>
                <input type="password" value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <button onClick={changeMyPassword} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              บันทึกรหัสผ่านใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
