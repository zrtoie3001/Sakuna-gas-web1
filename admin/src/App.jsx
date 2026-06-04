import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import Login from "./pages/Login.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Products from "./pages/Products.jsx";
import Discounts from "./pages/Discounts.jsx";
import Drivers from "./pages/Drivers.jsx";
import Customers from "./pages/Customers.jsx";
import Reports from "./pages/Reports.jsx";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="orders"    element={<Orders />} />
          <Route path="products"  element={<Products />} />
          <Route path="discounts" element={<Discounts />} />
          <Route path="drivers"   element={<Drivers />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reports"   element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
