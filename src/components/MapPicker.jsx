import { useGoogleMap } from "../hooks/useGoogleMap.js";
import { ZONES } from "../config.js";

const NAVY   = "#1A2B6B";
const ORANGE = "#F47B20";
const WHITE  = "#FFFFFF";
const GRAY   = "#6B7280";

export default function MapPicker({ onLocationSelect, locationData, apiZones }) {
  const { mapRef, loading, error, locData } = useGoogleMap({ onLocationSelect, apiZones });
  const loc = locationData || locData;

  // Zone color — support both static (A/B) and dynamic zones
  const zoneName = loc?.zone;
  const apiZone  = apiZones?.find(z => z.name === zoneName);
  const zoneColor = apiZone?.color || (zoneName === "A" ? "#059669" : zoneName === "B" ? "#D97706" : "#DC2626");
  const zoneLabel = apiZone?.label || (zoneName ? ZONES[zoneName]?.label : null);
  const inArea    = zoneName !== null && zoneName !== undefined;

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 4 }}>
        📍 แตะแผนที่เพื่อปักหมุดตำแหน่งจัดส่ง
      </p>
      <p style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>
        หรือกด "ใช้ตำแหน่งปัจจุบัน" เพื่อให้ระบบปักหมุดอัตโนมัติ
      </p>

      {/* Map box */}
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden",
        border: "2px solid #CBD5E1", height: 260 }}>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position: "absolute", inset: 0, background: "#EEF2FF",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", zIndex: 10, gap: 10 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${ORANGE}`,
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "spin 0.8s linear infinite" }}/>
            <p style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>กำลังโหลดแผนที่...</p>
          </div>
        )}

        {/* No API key fallback */}
        {error === "no_key" && (
          <div style={{ position: "absolute", inset: 0, background: "#FEF3C7",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: 20, zIndex: 10, gap: 8, textAlign: "center" }}>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#92400E" }}>ต้องใส่ Google Maps API Key</p>
            <p style={{ fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
              เปิดไฟล์ <code style={{ background: "#FDE68A", padding: "1px 4px", borderRadius: 4 }}>index.html</code>
              {" "}แล้วเปลี่ยน <code style={{ background: "#FDE68A", padding: "1px 4px", borderRadius: 4 }}>YOUR_GOOGLE_MAPS_API_KEY</code>
              {" "}เป็น key จริงของคุณ
            </p>
          </div>
        )}

        {/* Actual map div */}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* CSS spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Location result card */}
      {loc && (
        <div style={{ marginTop: 10, background: WHITE, borderRadius: 12,
          padding: "10px 14px", border: `2px solid ${inArea ? NAVY + "25" : "#FCA5A5"}`,
          display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>📍</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 2 }}>ตำแหน่งที่เลือก</p>
            <p style={{ fontSize: 11, color: GRAY, lineHeight: 1.5, wordBreak: "break-word" }}>
              {loc.address}
            </p>
            <p style={{ fontSize: 11, color: GRAY, marginTop: 3 }}>
              ห่างจากร้านประมาณ <strong>{loc.distKm.toFixed(1)} กม.</strong>
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {zoneLabel && (
              <div style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 8,
                background: zoneColor + "20", color: zoneColor, marginBottom: 4 }}>
                {zoneLabel}
              </div>
            )}
            <div style={{ fontSize: 9, color: "#999", marginBottom: 2 }}>
              zones:{apiZones?.length || 0} z:{zoneName}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700,
              color: inArea ? "#059669" : "#DC2626" }}>
              {inArea ? "✅ ในพื้นที่" : "⚠️ นอกพื้นที่"}
            </div>
          </div>
        </div>
      )}

      {/* Out of area warning */}
      {loc && !inArea && (
        <div style={{ marginTop: 8, background: "#FEF2F2", borderRadius: 10,
          padding: "8px 12px", fontSize: 12, color: "#991B1B" }}>
          ⚠️ ตำแหน่งนี้อยู่นอกพื้นที่จัดส่ง (พหลโยธิน 48 และรามอินทรา กม.1–4)
          กรุณาเลือกตำแหน่งใหม่
        </div>
      )}
    </div>
  );
}
