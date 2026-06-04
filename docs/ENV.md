# Environment Variables

## Customer Frontend (`/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | URL ของ Backend API เช่น `https://api.sakunngas.com` |
| `VITE_LINE_LIFF_ID` | ✅ | LIFF ID จาก LINE Developers Console |
| `VITE_QR_IMAGE_URL` | - | URL รูป QR Code สำหรับชำระเงิน |

## Admin (`/admin/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | URL ของ Backend API |

## Driver (`/driver/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | URL ของ Backend API |

## Backend (`/backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | - | Port ของ API server (default: 3001) |
| `NODE_ENV` | - | `development` หรือ `production` |
| `DB_HOST` | ✅ | PostgreSQL host |
| `DB_PORT` | - | PostgreSQL port (default: 5432) |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | ✅ | Database user |
| `DB_PASSWORD` | ✅ | Database password |
| `JWT_SECRET` | ✅ | Secret key สำหรับ JWT — ใช้ค่า random ยาวๆ |
| `JWT_EXPIRES_IN` | - | JWT expiry (default: `7d`) |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | จาก LINE Developers > Messaging API |
| `LINE_CHANNEL_SECRET` | ✅ | จาก LINE Developers > Messaging API |
| `LINE_LIFF_ID` | ✅ | จาก LINE Developers > LIFF |
| `LINE_ADMIN_IDS` | - | LINE User ID ของ Admin คั่นด้วย `,` สำหรับแจ้งเตือน |
| `GOOGLE_MAPS_API_KEY` | ✅ | Google Maps API Key (ต้องเปิด Distance Matrix, Geocoding, Directions API) |
| `SHOP_LAT` | ✅ | พิกัด Latitude ของร้าน |
| `SHOP_LNG` | ✅ | พิกัด Longitude ของร้าน |
| `FRONTEND_URL` | ✅ | URL ของ Customer LIFF app |
| `ADMIN_URL` | - | URL ของ Admin dashboard |
| `DRIVER_URL` | - | URL ของ Driver app |
| `PROMPTPAY_NUMBER` | - | เบอร์ PromptPay สำหรับ QR Payment |
| `UPLOAD_DIR` | - | โฟลเดอร์เก็บไฟล์อัปโหลด (default: `./uploads`) |

## วิธีขอ API Keys

### LINE Developers
1. ไปที่ https://developers.line.biz
2. สร้าง Provider และ Channel (Messaging API)
3. คัดลอก `Channel access token` และ `Channel secret`
4. สร้าง LIFF app ใน tab LIFF, คัดลอก `LIFF ID`
5. ตั้งค่า Webhook URL เป็น `https://your-domain.com/webhook/line`

### Google Maps
1. ไปที่ https://console.cloud.google.com
2. สร้าง Project ใหม่
3. เปิดใช้งาน APIs:
   - Maps JavaScript API
   - Distance Matrix API
   - Directions API
   - Geocoding API
4. สร้าง API Key และจำกัด domain
