// ─────────────────────────────────────────────
//  ร้านสกุณาแก๊ส — ข้อมูลราคาและโซน
// ─────────────────────────────────────────────

// พิกัดร้านสกุณาแก๊ส (ถ.พหลโยธิน 48)
export const SHOP_LAT = 13.872760086238907;
export const SHOP_LNG = 100.62466719582359;

export const DISCOUNT_CODES = {
  sakuna10: 10,
  sakuna15: 15,
};

// โซนจัดส่ง (กำหนดจากระยะทางจากร้าน)
export const ZONES = {
  A: { label: "โซน A", desc: "ใกล้ร้าน (≤ 3 กม.)", maxKm: 3, color: "#059669" },
  B: { label: "โซน B", desc: "ไกลขึ้น (3–7 กม.)",  maxKm: 7, color: "#D97706" },
};

// ยี่ห้อแก๊ส
// image: ใช้ URL รูปจริง หรือเปลี่ยนเป็น path รูปของคุณเอง
export const BRANDS = [
  {
    id: "ptt",
    name: "ปตท.",
    color: "#DC2626",
    bgColor: "#FEF2F2",
    // รูปจาก URL สาธารณะ (เปลี่ยนเป็นรูปจริงของถังแต่ละยี่ห้อได้เลย)
    image: "/images/PTT.jpg",
    imageFallback: "🔴",
  },
  {
    id: "pap",
    name: "PAP",
    color: "#1D4ED8",
    bgColor: "#EFF6FF",
    image: "/images/PAP.jpg",
    imageFallback: "🔵",
  },
  {
    id: "world",
    name: "เวิลด์",
    color: "#059669",
    bgColor: "#ECFDF5",
    image: "/images/World.jpg",
    imageFallback: "🟢",
  },
  {
    id: "unique",
    name: "ยูนิค",
    color: "#D97706",
    bgColor: "#FFFBEB",
    image: "/images/Unique.png",
    imageFallback: "🟠",
  },
  {
    id: "siam",
    name: "สยาม",
    color: "#7C3AED",
    bgColor: "#F5F3FF",
    image: "/images/Siam.png",
    imageFallback: "🟣",
  },
];

// ราคาสินค้า
// shopPrice: ราคาร้านค้า แยกตามโซน A/B
// homePrice: ราคาบ้านพักอาศัย
export const PRODUCTS = [
  {
    id: "p4",
    name: "ถัง 4 กก.",
    kg: 4,
    homePrice: 200,
    shopPrice: { A: 200, B: 200 },   // ราคาเท่ากัน ทุกโซน
    desc: "เหมาะสำหรับบ้านพักอาศัยทั่วไป",
    hot: false,
  },
  {
    id: "p7",
    name: "ถัง 7 กก.",
    kg: 7,
    homePrice: 305,
    shopPrice: { A: 285, B: 300 },
    desc: "ขนาดกลาง เหมาะครัวเรือนและร้านค้า",
    hot: false,
  },
  {
    id: "p15",
    name: "ถัง 15 กก.",
    kg: 15,
    homePrice: 450,
    shopPrice: { A: 435, B: 440 },
    desc: "ขายดีที่สุด เหมาะบ้านขนาดกลาง-ใหญ่",
    hot: true,
  },
  {
    id: "p48",
    name: "ถัง 48 กก.",
    kg: 48,
    homePrice: 1495,
    shopPrice: { A: 1495, B: 1495 }, // ราคาเท่ากัน
    desc: "สำหรับร้านอาหาร / ใช้งานหนัก",
    hot: false,
  },
];

// คำนวณระยะทาง (Haversine formula)
export function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// กำหนดโซนจากระยะทาง (fallback เมื่อยังไม่ได้โหลด zones จาก API)
export function getZoneFromDist(km) {
  if (km <= ZONES.A.maxKm) return "A";
  if (km <= ZONES.B.maxKm) return "B";
  return null; // นอกพื้นที่
}

function pointInPolygon(lat, lng, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lat, yi = coords[i].lng;
    const xj = coords[j].lat, yj = coords[j].lng;
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

// ตรวจโซนจาก API zones (polygon ก่อน แล้ว distance zones)
export function detectZone(lat, lng, distKm, apiZones) {
  if (!apiZones?.length) return getZoneFromDist(distKm);
  // polygon zones first
  for (const z of apiZones) {
    if (z.polygonCoords) {
      try {
        const coords = JSON.parse(z.polygonCoords);
        if (pointInPolygon(lat, lng, coords)) return z.name;
      } catch {}
    }
  }
  // distance zones
  const distZones = [...apiZones].filter(z => !z.polygonCoords && !z.centerLat).sort((a, b) => Number(a.maxKm) - Number(b.maxKm));
  for (const z of distZones) {
    if (distKm <= Number(z.maxKm)) return z.name;
  }
  return null;
}

// หาราคาสินค้าตามโซน
export function getPriceForZone(product, zoneName, apiZones) {
  if (!zoneName || !apiZones?.length) return Number(product.homePrice);
  const zone = apiZones.find(z => z.name === zoneName);
  if (!zone) return Number(product.homePrice);
  const zp = zone.zonePrices?.find(p => p.productId === product.id);
  return zp ? Number(zp.price) : Number(product.homePrice);
}
