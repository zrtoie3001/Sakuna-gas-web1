import { useEffect, useRef, useState, useCallback } from "react";
import { SHOP_LAT, SHOP_LNG, getDistanceKm, detectZone } from "../config.js";

// โหลด Google Maps Script แบบ lazy
function loadMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(); return; }
    const existing = document.getElementById("gmap-script");
    if (existing) { existing.addEventListener("load", resolve); return; }
    const script = document.createElement("script");
    script.id = "gmap-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=th&region=TH`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function useGoogleMap({ onLocationSelect, apiZones }) {
  const mapRef     = useRef(null);   // div element
  const mapObj     = useRef(null);   // google.maps.Map
  const markerRef  = useRef(null);   // google.maps.Marker
  const shopMarker = useRef(null);   // shop pin

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [locData, setLocData]   = useState(null); // { lat, lng, address, distKm, zone }

  // Default center: พหลโยธิน–รามอินทรา
  const CENTER = { lat: 13.855, lng: 100.590 };

  useEffect(() => {
    const apiKey = window.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
      setError("no_key");
      setLoading(false);
      return;
    }

    loadMapsScript(apiKey)
      .then(() => {
        if (!mapRef.current) return;

        // สร้าง map
        const map = new window.google.maps.Map(mapRef.current, {
          center: CENTER,
          zoom: 14,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "simplified" }] },
          ],
        });
        mapObj.current = map;

        // Shop marker
        shopMarker.current = new window.google.maps.Marker({
          position: { lat: SHOP_LAT, lng: SHOP_LNG },
          map,
          title: "ร้านสกุณาแก๊ส",
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">
                <path d="M21 0C9.4 0 0 9.4 0 21c0 14.7 18.3 29.4 21 31s21-16.3 21-31C42 9.4 32.6 0 21 0z" fill="#F47B20"/>
                <circle cx="21" cy="21" r="13" fill="white"/>
                <text x="21" y="26" text-anchor="middle" font-size="13" font-weight="900" fill="#1A2B6B" font-family="sans-serif">ร้าน</text>
              </svg>`),
            scaledSize: new window.google.maps.Size(42, 52),
            anchor: new window.google.maps.Point(21, 52),
          },
          zIndex: 10,
        });

        // Draggable user marker (สร้างตอนที่ผู้ใช้คลิก)
        function placeMarker(latLng) {
          const lat = latLng.lat();
          const lng = latLng.lng();

          if (!markerRef.current) {
            markerRef.current = new window.google.maps.Marker({
              position: latLng,
              map,
              draggable: true,
              animation: window.google.maps.Animation.DROP,
              title: "ตำแหน่งจัดส่ง",
              icon: {
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
                    <path d="M18 0C8.1 0 0 8.1 0 18c0 12.6 16 28 18 28s18-15.4 18-28C36 8.1 27.9 0 18 0z" fill="#1A2B6B"/>
                    <circle cx="18" cy="18" r="9" fill="#F47B20"/>
                    <circle cx="18" cy="18" r="4.5" fill="white"/>
                  </svg>`),
                scaledSize: new window.google.maps.Size(36, 46),
                anchor: new window.google.maps.Point(18, 46),
              },
            });

            // อัปเดตตำแหน่งเมื่อลาก
            markerRef.current.addListener("dragend", (e) => {
              updateLocation(e.latLng.lat(), e.latLng.lng());
            });
          } else {
            markerRef.current.setPosition(latLng);
          }

          updateLocation(lat, lng);
        }

        function updateLocation(lat, lng) {
          const distKm = getDistanceKm(SHOP_LAT, SHOP_LNG, lat, lng);
          const zone   = detectZone(lat, lng, distKm, apiZones);

          // Reverse geocode เพื่อได้ที่อยู่
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng }, language: "th" }, (results, status) => {
            const address = status === "OK" && results[0]
              ? results[0].formatted_address
              : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            const data = { lat, lng, address, distKm, zone };
            setLocData(data);
            onLocationSelect?.(data);
          });
        }

        // คลิกแผนที่
        map.addListener("click", (e) => placeMarker(e.latLng));

        // ลอง GPS ปักหมุดอัตโนมัติ
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const ll = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
              map.setCenter(ll);
              map.setZoom(16);
              placeMarker(ll);
            },
            () => { /* GPS denied — ไม่เป็นไร */ }
          );
        }

        setLoading(false);
      })
      .catch(() => {
        setError("load_failed");
        setLoading(false);
      });
  }, []);

  return { mapRef, loading, error, locData };
}
