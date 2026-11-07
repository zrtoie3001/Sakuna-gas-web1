import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Component, useEffect, useRef } from "react";
import Login from "./pages/Login.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Products from "./pages/Products.jsx";
import Discounts from "./pages/Discounts.jsx";
import Drivers from "./pages/Drivers.jsx";
import Customers from "./pages/Customers.jsx";
import Reports from "./pages/Reports.jsx";
import Stock from "./pages/Stock.jsx";
import Settings from "./pages/Settings.jsx";
import Debts from "./pages/Debts.jsx";
import Expenses from "./pages/Expenses.jsx";
import Finance from "./pages/Finance.jsx";
import CashBalance from "./pages/CashBalance.jsx";
import MapView from "./pages/MapView.jsx";
import Reminders from "./pages/Reminders.jsx";

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidUpdate(_, prev) {
    if (this.state.error && prev.error === this.state.error) return;
  }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, color: "#374151", marginBottom: 20 }}>เกิดข้อผิดพลาด กรุณารีเฟรชหน้า</div>
        <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{ padding: "10px 24px", borderRadius: 10, background: "#1E3A5F", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          รีเฟรช
        </button>
      </div>
    );
    return this.props.children;
  }
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  return token ? children : <Navigate to="/login" replace />;
}

// Reset error boundary on route change
function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const times = [0, 0.25, 0.5];
    times.forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + t + 0.15);
      gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
    });
  } catch {}
}

function ReminderChecker() {
  const firedRef = useRef({});
  useEffect(() => {
    function check() {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const day = now.getDay();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const key = `${hhmm}-${now.toDateString()}`;
      try {
        const list = JSON.parse(localStorage.getItem("reminders") || "[]");
        list.forEach(r => {
          const fkey = `${r.id}-${key}`;
          if (r.time === hhmm && r.days.includes(day) && !firedRef.current[fkey]) {
            firedRef.current[fkey] = true;
            playDing();
            new Notification("🔔 แจ้งเตือนส่งแก๊ส", {
              body: `${r.name}${r.note ? " · " + r.note : ""}`,
              icon: "/favicon.ico",
            });
          }
        });
      } catch {}
    }
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ReminderChecker />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
          <Route path="orders"    element={<RouteErrorBoundary><Orders /></RouteErrorBoundary>} />
          <Route path="products"  element={<RouteErrorBoundary><Products /></RouteErrorBoundary>} />
          <Route path="discounts" element={<RouteErrorBoundary><Discounts /></RouteErrorBoundary>} />
          <Route path="drivers"   element={<RouteErrorBoundary><Drivers /></RouteErrorBoundary>} />
          <Route path="customers" element={<RouteErrorBoundary><Customers /></RouteErrorBoundary>} />
          <Route path="reports"   element={<RouteErrorBoundary><Reports /></RouteErrorBoundary>} />
          <Route path="stock"     element={<RouteErrorBoundary><Stock /></RouteErrorBoundary>} />
          <Route path="debts"     element={<RouteErrorBoundary><Debts /></RouteErrorBoundary>} />
          <Route path="expenses"  element={<RouteErrorBoundary><Expenses /></RouteErrorBoundary>} />
          <Route path="cash"      element={<RouteErrorBoundary><CashBalance /></RouteErrorBoundary>} />
          <Route path="finance"   element={<RouteErrorBoundary><Finance /></RouteErrorBoundary>} />
          <Route path="settings"  element={<RouteErrorBoundary><Settings /></RouteErrorBoundary>} />
          <Route path="map"       element={<RouteErrorBoundary><MapView /></RouteErrorBoundary>} />
          <Route path="reminders" element={<RouteErrorBoundary><Reminders /></RouteErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
