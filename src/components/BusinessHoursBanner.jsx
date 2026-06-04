import { useState, useEffect } from "react";

export default function BusinessHoursBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/v1/maps/business-hours`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status) return null;

  return (
    <div style={{
      padding: "6px 16px",
      background: status.isOpen ? "#D1FAE5" : "#FEF3C7",
      fontSize: 11,
      color: status.isOpen ? "#065F46" : "#92400E",
      textAlign: "center",
    }}>
      {status.isOpen
        ? `🟢 ร้านเปิดอยู่ · ${status.schedule.weekdays}`
        : `🔴 ร้านปิดแล้ว — จะเปิดอีกครั้ง${status.nextOpenTime} · คุณสามารถสั่งล่วงหน้าได้เลย`}
    </div>
  );
}
