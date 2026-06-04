const axios = require("axios");

const SHOP_LAT = parseFloat(process.env.SHOP_LAT);
const SHOP_LNG = parseFloat(process.env.SHOP_LNG);
const KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE = "https://maps.googleapis.com/maps/api";

async function getDistanceMatrix(origins, destinations) {
  const resp = await axios.get(`${BASE}/distancematrix/json`, {
    params: {
      origins: origins.join("|"),
      destinations: destinations.join("|"),
      key: KEY,
      language: "th",
      units: "metric",
    },
  });
  return resp.data;
}

async function getDeliveryInfo(destLat, destLng) {
  const data = await getDistanceMatrix(
    [`${SHOP_LAT},${SHOP_LNG}`],
    [`${destLat},${destLng}`]
  );
  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return { distanceKm: null, durationMins: null };
  }
  return {
    distanceKm: element.distance.value / 1000,
    durationMins: Math.ceil(element.duration.value / 60),
  };
}

async function geocode(address) {
  const resp = await axios.get(`${BASE}/geocode/json`, {
    params: { address, key: KEY, language: "th" },
  });
  const result = resp.data.results?.[0];
  if (!result) return null;
  const { lat, lng } = result.geometry.location;
  return { lat, lng, formattedAddress: result.formatted_address };
}

async function reverseGeocode(lat, lng) {
  const resp = await axios.get(`${BASE}/geocode/json`, {
    params: { latlng: `${lat},${lng}`, key: KEY, language: "th" },
  });
  return resp.data.results?.[0]?.formatted_address || `${lat},${lng}`;
}

// Optimize delivery route for multiple stops
async function optimizeRoute(driverLat, driverLng, stops) {
  if (!stops.length) return stops;
  // Use Directions API with waypoints optimization
  const waypoints = stops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|");
  const resp = await axios.get(`${BASE}/directions/json`, {
    params: {
      origin: `${driverLat},${driverLng}`,
      destination: `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`,
      waypoints: waypoints ? `optimize:true|${waypoints}` : undefined,
      key: KEY,
      language: "th",
    },
  });
  const order = resp.data.routes?.[0]?.waypoint_order || [];
  // Reorder stops based on optimized waypoint order
  const reordered = [stops[0], ...order.map(i => stops[i + 1]), stops[stops.length - 1]];
  return reordered.filter(Boolean);
}

module.exports = { getDeliveryInfo, geocode, reverseGeocode, optimizeRoute, getDistanceMatrix };
