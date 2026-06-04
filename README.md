# 🔥 สกุณาแก๊ส — ระบบสั่งแก๊สผ่าน LINE OA (Production Ready)

ระบบสั่งแก๊สออนไลน์ครบวงจร สำหรับร้าน **สกุณาแก๊ส** — รองรับลูกค้า, Admin และพนักงานส่ง แยกสิทธิ์ชัดเจน

---

## โครงสร้างโปรเจกต์

```
sakunna-gas-app/
├── src/                        # 👤 Customer LIFF App (LINE OA)
│   ├── App.jsx                 #    Multi-step order form
│   ├── config.js               #    ราคา, โซน, ยี่ห้อ
│   ├── hooks/
│   │   ├── useLiff.js          #    LINE LIFF authentication
│   │   └── useGoogleMap.js     #    Google Maps integration
│   ├── components/
│   │   ├── MapPicker.jsx       #    ปักหมุดตำแหน่งบนแผนที่
│   │   ├── BusinessHoursBanner.jsx  # แสดงสถานะเปิด/ปิดร้าน
│   │   └── order/
│   │       ├── DiscountCode.jsx     # กรอกและตรวจสอบโค้ดส่วนลด
│   │       ├── PaymentStep.jsx      # เลือกวิธีชำระ + อัปโหลดสลิป
│   │       ├── CustomerInfoStep.jsx # กรอกชื่อ-เบอร์-หมายเหตุ
│   │       └── ReturningCustomer.jsx # ลูกค้าเก่า — เลือกที่อยู่เดิม
│   └── pages/
│       └── OrderTracking.jsx   #    ติดตามสถานะออเดอร์
│
├── admin/                      # 🔐 Admin Dashboard
│   └── src/pages/
│       ├── Login.jsx           #    เข้าสู่ระบบ (role: admin เท่านั้น)
│       ├── Dashboard.jsx       #    Stats + ออเดอร์ล่าสุด
│       ├── Orders.jsx          #    จัดการออเดอร์ทั้งหมด
│       ├── Products.jsx        #    จัดการสินค้า + ยี่ห้อ
│       ├── Discounts.jsx       #    สร้าง/จัดการโค้ดส่วนลด
│       ├── Drivers.jsx         #    จัดการพนักงาน
│       ├── Customers.jsx       #    ประวัติลูกค้า
│       └── Reports.jsx         #    รายงาน + Export CSV
│
├── driver/                     # 🛵 Driver App
│   └── src/pages/
│       ├── Login.jsx           #    เข้าสู่ระบบ (role: driver เท่านั้น)
│       └── Dashboard.jsx       #    รับงาน, อัปเดตสถานะ, นำทาง
│
├── backend/                    # ⚙️ Node.js + Express API
│   ├── app.js
│   ├── src/
│   │   ├── controllers/        #    Business logic
│   │   ├── models/             #    Sequelize ORM models
│   │   ├── routes/             #    Express routes
│   │   ├── middleware/         #    JWT auth + role check
│   │   └── services/
│   │       ├── lineService.js  #    LINE push notifications
│   │       └── mapsService.js  #    Google Maps API
│   └── database/
│       ├── schema.sql          #    PostgreSQL schema
│       └── seed.sql            #    ข้อมูลเริ่มต้น
│
├── docs/                       # 📚 Documentation
│   ├── API.md                  #    API Reference
│   ├── ER_DIAGRAM.md           #    Database diagram
│   ├── ENV.md                  #    Environment variables
│   └── DEPLOYMENT.md           #    Deploy guide
│
├── docker-compose.yml          # 🐳 Docker setup
├── nginx.conf                  # 🌐 Nginx config
└── package.json                # Root monorepo scripts
```

---

## เทคโนโลยี

| Layer    | Stack                                    |
|----------|------------------------------------------|
| Frontend | React 18 + Vite + inline CSS             |
| Backend  | Node.js 20 + Express 4 + Sequelize 6    |
| Database | PostgreSQL 15                            |
| Auth     | JWT (Admin/Driver) + LINE LIFF (Customer)|
| Maps     | Google Maps JS API + Distance Matrix     |
| LINE     | Messaging API + LIFF SDK                 |
| Deploy   | Docker + Nginx                           |

---

## ความปลอดภัย (Role Separation)

| หน้า            | URL       | Auth               |
|-----------------|-----------|--------------------|
| Customer LIFF   | `/`       | LINE LIFF Token    |
| Admin Dashboard | `/admin`  | JWT (role: admin)  |
| Driver App      | `/driver` | JWT (role: driver) |

- ลูกค้า **ไม่สามารถเข้าถึง** `/admin` หรือ `/driver` ได้
- Driver เห็นเฉพาะออเดอร์ของตัวเอง ไม่สามารถเข้า Admin ได้
- Admin เห็นทุกอย่าง

---

## วิธีติดตั้ง

### 1. ติดตั้ง dependencies
```bash
npm run install:all
```

### 2. ตั้งค่า Environment
```bash
cp .env.example .env
cp backend/.env.example backend/.env
# แก้ไข API Keys ทั้งหมด
```

### 3. Setup Database
```bash
createdb sakunna_gas
psql sakunna_gas < backend/database/schema.sql
psql sakunna_gas < backend/database/seed.sql
```

### 4. รัน Dev
```bash
npm run dev           # รันทุก app พร้อมกัน
# หรือแยก:
npm run dev:backend   # http://localhost:3001
npm run dev:customer  # http://localhost:5173
npm run dev:admin     # http://localhost:5174
npm run dev:driver    # http://localhost:5175
```

### 5. Deploy (Docker)
```bash
npm run build
docker-compose up -d --build
```

---

## Test Accounts (Seed Data)

| Role   | Email                 | Password    |
|--------|-----------------------|-------------|
| Admin  | admin@sakunngas.com   | Admin@1234  |
| Driver | driver1@sakunngas.com | Driver@1234 |
| Driver | driver2@sakunngas.com | Driver@1234 |

---

## เวลาทำการ

| วัน           | เวลา          |
|---------------|---------------|
| จันทร์–เสาร์  | 07:00–19:00   |
| อาทิตย์       | 07:00–13:00   |

ระบบจะแจ้งเตือนลูกค้าอัตโนมัติหากสั่งนอกเวลาทำการ

---

## เอกสาร

- [📡 API Reference](docs/API.md)
- [🗃 ER Diagram](docs/ER_DIAGRAM.md)
- [⚙️ Environment Variables](docs/ENV.md)
- [🚀 Deployment Guide](docs/DEPLOYMENT.md)
