import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

const NAVY = "#1A2B6B"; const NAVY2 = "#0F1D52"; const ORANGE = "#F47B20"; const WHITE = "#FFFFFF";

export default function Login() {
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoad]  = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault(); setLoad(true); setError("");
    try {
      const { data } = await api.post("/api/v1/auth/login", { email, password: pass });
      if (data.user.role !== "driver") { setError("บัญชีนี้ไม่ใช่พนักงานส่ง"); return; }
      localStorage.setItem("driver_token", data.token);
      localStorage.setItem("driver_user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "เข้าสู่ระบบไม่สำเร็จ");
    } finally { setLoad(false); }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${NAVY2}, ${NAVY})`, padding: 16,
    }}>
      <div style={{ background: WHITE, borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52 }}>🛵</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY }}>พนักงานส่งแก๊ส</h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>สกุณาแก๊ส Driver App</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="driver@sakunngas.com"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} required placeholder="••••••••"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "2px solid #E5E7EB", fontSize: 14 }} />
          </div>
          {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>⚠️ {error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: 14, borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})`, color: WHITE,
            fontWeight: 800, fontSize: 15, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
