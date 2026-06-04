const router = require("express").Router();
const { getDeliveryInfo, reverseGeocode } = require("../services/mapsService");
const { isOpen, getNextOpenTime } = require("../utils/businessHours");

router.get("/delivery-info", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  const info = await getDeliveryInfo(parseFloat(lat), parseFloat(lng));
  res.json(info);
});

router.get("/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;
  const address = await reverseGeocode(parseFloat(lat), parseFloat(lng));
  res.json({ address });
});

router.get("/business-hours", (_req, res) => {
  const open = isOpen();
  res.json({
    isOpen: open,
    nextOpenTime: open ? null : getNextOpenTime(),
    schedule: {
      weekdays: "จันทร์–เสาร์ 07:00–19:00",
      sunday:   "อาทิตย์ 07:00–13:00",
    },
  });
});

module.exports = router;
