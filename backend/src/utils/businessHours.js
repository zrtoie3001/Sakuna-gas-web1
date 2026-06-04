// สกุณาแก๊ส: จันทร์-เสาร์ 07:00-19:00, อาทิตย์ 07:00-13:00
function isOpen(date = new Date()) {
  const day = date.getDay(); // 0=อาทิตย์ ... 6=เสาร์
  const h = date.getHours();
  const m = date.getMinutes();
  const mins = h * 60 + m;

  if (day === 0) return mins >= 7 * 60 && mins < 13 * 60;      // อาทิตย์
  if (day >= 1 && day <= 6) return mins >= 7 * 60 && mins < 19 * 60; // จันทร์-เสาร์
  return false;
}

function getNextOpenTime(date = new Date()) {
  const day = date.getDay();
  if (day === 0) return "วันจันทร์เวลา 07:00 น.";
  const h = date.getHours();
  if (h < 7) return "เวลา 07:00 น. วันนี้";
  if (day === 6 && h >= 19) return "วันจันทร์เวลา 07:00 น.";
  return "วันพรุ่งนี้เวลา 07:00 น.";
}

module.exports = { isOpen, getNextOpenTime };
