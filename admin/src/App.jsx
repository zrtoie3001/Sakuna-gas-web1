import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Component } from "react";
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

export default function App() {
  return (
    <BrowserRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
