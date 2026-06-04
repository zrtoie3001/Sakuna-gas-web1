# สกุณาแก๊ส — API Documentation

Base URL: `http://localhost:3001/api/v1`

## Authentication

| หน้า         | Auth Method                        |
|--------------|------------------------------------|
| Customer     | ไม่ต้อง (ระบุ lineUserId ใน body) |
| Admin        | `Authorization: Bearer <JWT>`       |
| Driver       | `Authorization: Bearer <JWT>`       |

---

## Auth

### POST /auth/login
เข้าสู่ระบบ (Admin/Driver)

**Body:**
```json
{ "email": "admin@sakunngas.com", "password": "Admin@1234" }
```
**Response:**
```json
{ "token": "eyJ...", "user": { "id": "...", "name": "...", "role": "admin" } }
```

### GET /auth/me _(🔒 JWT)_
ข้อมูลผู้ใช้ปัจจุบัน

---

## Orders

### POST /orders
สร้างออเดอร์ใหม่ (ลูกค้า)

**Body:**
```json
{
  "lineUserId": "U1234567890abcdef",
  "brandId": "b0000000-...",
  "productId": "p0000000-...",
  "qty": 1,
  "customerName": "สมศรี ทดสอบ",
  "customerPhone": "0899999999",
  "deliveryLat": 13.8720,
  "deliveryLng": 100.5780,
  "deliveryAddress": "123 ถ.พหลโยธิน...",
  "customerType": "home",
  "paymentMethod": "cash",
  "discountCode": "WELCOME50",
  "note": "บ้านหลังใหญ่"
}
```
**Response:** `201` Order object + `isOffHours`, `nextOpenTime`

### GET /orders/:id
ดูสถานะออเดอร์ (ลูกค้าติดตาม)

### POST /orders/:id/slip
อัปโหลดสลิปโอนเงิน

**Form-data:** `slip` (image file)

### GET /orders _(🔒 Admin)_
รายการออเดอร์ทั้งหมด

**Query:** `?status=pending&date=2024-01-15&page=1&limit=20`

### PUT /orders/:id/status _(🔒 Admin/Driver)_
เปลี่ยนสถานะออเดอร์

**Body:**
```json
{ "status": "out_for_delivery", "estimatedMinutes": 20 }
```

### POST /orders/:id/accept _(🔒 Driver)_
พนักงานรับงาน

---

## Products

### GET /products/brands
รายการยี่ห้อแก๊สทั้งหมด

### GET /products
รายการสินค้าพร้อมราคาทุกโซน

### GET /products/zones
โซนจัดส่งและค่าจัดส่ง

### POST /products/brands _(🔒 Admin)_
เพิ่มยี่ห้อใหม่

### PUT /products/brands/:id _(🔒 Admin)_
แก้ไขยี่ห้อ / เปิด-ปิดการขาย

### POST /products _(🔒 Admin)_
เพิ่มสินค้าพร้อมราคาทุกโซน

**Body:**
```json
{
  "name": "ถัง 15 กก.",
  "kg": 15,
  "homePrice": 450,
  "description": "ขายดีที่สุด",
  "isHot": true,
  "zonePrices": [
    { "zoneId": "z0000000-...", "price": 435 },
    { "zoneId": "z0000001-...", "price": 440 }
  ]
}
```

---

## Customers

### GET /customers/line/:lineUserId
ดึงข้อมูลลูกค้าจาก LINE ID พร้อมที่อยู่และประวัติออเดอร์

### GET /customers/line/:lineUserId/addresses
รายการที่อยู่ทั้งหมดของลูกค้า

### POST /customers/line/:lineUserId/addresses
เพิ่มที่อยู่ใหม่

**Body:**
```json
{
  "label": "บ้าน",
  "address": "123 ถ.พหลโยธิน...",
  "lat": 13.872,
  "lng": 100.578,
  "isDefault": true
}
```

### GET /customers _(🔒 Admin)_
รายการลูกค้าทั้งหมด — `?search=สมศรี&page=1`

### GET /customers/:id/orders _(🔒 Admin)_
ประวัติออเดอร์ของลูกค้า

---

## Discounts

### POST /discounts/validate
ตรวจสอบโค้ดส่วนลด

**Body:**
```json
{ "code": "WELCOME50", "subtotal": 450, "zone": "A" }
```
**Response:**
```json
{ "valid": true, "discount": 50, "description": "ส่วนลดลูกค้าใหม่" }
```

### GET /discounts _(🔒 Admin)_
รายการโค้ดทั้งหมด

### POST /discounts _(🔒 Admin)_
สร้างโค้ด

**Body:**
```json
{
  "code": "SAVE10PCT",
  "type": "percent",
  "value": 10,
  "minOrderAmount": 500,
  "maxUses": 50,
  "expiresAt": "2024-12-31T23:59:59Z",
  "allowedZones": ["A", "B"],
  "description": "ลด 10% ยอดตั้งแต่ 500 บาท"
}
```

### PUT /discounts/:id _(🔒 Admin)_
แก้ไขโค้ด (รวมถึงเปิด/ปิด)

### DELETE /discounts/:id _(🔒 Admin)_
ลบโค้ด

---

## Drivers

### GET /drivers/my-orders _(🔒 Driver)_
ออเดอร์ที่รับแล้วของพนักงาน

### GET /drivers/pending _(🔒 Driver/Admin)_
ออเดอร์รอรับงาน

### GET /drivers/route _(🔒 Driver)_
เส้นทางส่งที่เหมาะสมที่สุด

**Query:** `?lat=13.87&lng=100.57`

### PUT /drivers/location _(🔒 Driver)_
อัปเดตพิกัดพนักงาน

**Body:** `{ "lat": 13.87, "lng": 100.57 }`

### GET /drivers _(🔒 Admin)_
รายการพนักงานทั้งหมด

### GET /drivers/locations _(🔒 Admin)_
ตำแหน่งพนักงานแบบ Real-time

### POST /drivers _(🔒 Admin)_
เพิ่มพนักงานใหม่

---

## Reports

### GET /reports/dashboard _(🔒 Admin)_
ข้อมูล Dashboard (ออเดอร์วันนี้, ยอดขาย, ลูกค้า, pending)

### GET /reports/daily _(🔒 Admin)_
รายงานรายวัน — `?date=2024-01-15`

### GET /reports/monthly _(🔒 Admin)_
รายงานรายเดือน — `?year=2024&month=1`

---

## Maps

### GET /maps/delivery-info
คำนวณระยะทางและเวลาจากร้านไปลูกค้า

**Query:** `?lat=13.87&lng=100.57`

### GET /maps/reverse-geocode
แปลงพิกัดเป็นที่อยู่ — `?lat=13.87&lng=100.57`

### GET /maps/business-hours
ตรวจสอบเวลาทำการ

---

## Webhook

### POST /webhook/line
LINE Messaging API Webhook (ตอบกลับ Chatbot อัตโนมัติ)

---

## Order Status Flow

```
pending → preparing → out_for_delivery → near_destination → delivered
                                                           ↘
                                                         cancelled
```

| Status              | ใครเปลี่ยน       | LINE แจ้งเตือน |
|---------------------|------------------|----------------|
| pending             | ระบบ (auto)      | ✅ ลูกค้า + Admin |
| preparing           | Driver / Admin   | ✅ ลูกค้า      |
| out_for_delivery    | Driver           | ✅ ลูกค้า      |
| near_destination    | Driver           | ✅ ลูกค้า      |
| delivered           | Driver           | ✅ ลูกค้า      |
| cancelled           | Admin            | ✅ ลูกค้า      |
