import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../utils/api.js";

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";

const NAV = [
  { to: "/",          icon: "📊", label: "Dashboard" },
  { to: "/orders",    icon: "📦", label: "ออเดอร์" },
  { to: "/products",  icon: "🛢", label: "สินค้า" },
  { to: "/discounts", icon: "🎟", label: "โค้ดส่วนลด" },
  { to: "/drivers",   icon: "🛵", label: "พนักงาน" },
  { to: "/customers", icon: "👥", label: "ลูกค้า" },
  { to: "/reports",   icon: "📈", label: "รายงาน" },
];

export default function Layout() {
  const navigate  = useNavigate();
  const user      = JSON.parse(localStorage.getItem("admin_user") || "{}");
  const [sideOpen, setSideOpen] = useState(false);
  const [pwModal, setPwModal]   = useState(false);
  const [pwForm, setPwForm]     = useState({ current: "", next: "", confirm: "" });

  async function changeMyPassword() {
    if (pwForm.next.length < 6) return alert("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว");
    if (pwForm.next !== pwForm.confirm) return alert("รหัสผ่านใหม่ไม่ตรงกัน");
    try {
      await api.put(`/api/v1/drivers/${user.id}`, { password: pwForm.next });
      alert("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      setPwModal(false); setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) { alert(e.response?.data?.error || "เกิดข้อผิดพลาด"); }
  }

  function logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    navigate("/login");
  }

  const Sidebar = ({ mobile }) => (
    <div style={{
      width: mobile ? "100%" : 220, flexShrink: 0,
      background: `linear-gradient(180deg, ${NAVY2} 0%, ${NAVY} 100%)`,
      display: "flex", flexDirection: "column",
      height: mobile ? "auto" : "100vh",
      position: mobile ? "relative" : "sticky", top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: WHITE }}>
          🔥 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 3 }}>Admin Panel</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setSideOpen(false)}
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

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginBottom: 10 }}>
          👤 {user.name || "Admin"}
        </div>
        <button onClick={() => setPwModal(true)} style={{
          width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
          background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer", marginBottom: 6,
        }}>
          🔑 เปลี่ยนรหัสผ่าน
        </button>
        <button onClick={logout} style={{
          width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
          background: "transparent", color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer",
        }}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      <div style={{ display: "none" }} className="desktop-sidebar">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sideOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex",
        }}>
          <div style={{ width: 240 }}><Sidebar mobile /></div>
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
          <button onClick={() => setSideOpen(!sideOpen)} style={{
            background: "none", border: "none", fontSize: 20, color: NAVY, cursor: "pointer",
          }}>☰</button>
          <span style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>
            🔥 สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280" }}>
            Admin: {user.name}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          <Outlet />
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
