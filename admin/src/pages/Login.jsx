import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

const NAVY   = "#1A2B6B";
const NAVY2  = "#0F1D52";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";

export default function Login() {
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/api/v1/auth/login", { email, password });
      if (data.user.role !== "admin" && data.user.role !== "both") { setError("ไม่มีสิทธิ์เข้าใช้งาน"); return; }
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 60%, #2D3A8C 100%)`,
    }}>
      <div style={{
        background: WHITE, borderRadius: 20, padding: 40,
        width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48 }}>🔥</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY }}>
            สกุณา<span style={{ color: ORANGE }}>แก๊ส</span>
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#374151", display: "block", marginBottom: 5, fontWeight: 700 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@sakunngas.com"
              required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "2px solid #E5E7EB", fontSize: 14, outline: "none",
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: "#374151", display: "block", marginBottom: 5, fontWeight: 700 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                border: "2px solid #E5E7EB", fontSize: 14, outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: 14, borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`,
            color: WHITE, fontWeight: 800, fontSize: 15,
            boxShadow: "0 4px 16px rgba(26,43,107,.3)",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 20 }}>
          🔒 ระบบนี้สำหรับ Admin เท่านั้น
        </p>
      </div>
    </div>
  );
}
