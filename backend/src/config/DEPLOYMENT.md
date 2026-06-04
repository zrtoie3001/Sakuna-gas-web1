# Deployment Guide — สกุณาแก๊ส

## ตัวเลือกการ Deploy

### Option A: Docker Compose (แนะนำ)

```bash
# 1. Clone repo
git clone <repo-url>
cd sakunna-gas-app

# 2. สร้าง .env
cp .env.example .env
# แก้ไขค่าทั้งหมดใน .env

# 3. Build frontend
npm run install:all
npm run build

# 4. Deploy
docker-compose up -d --build

# 5. ตรวจสอบ
docker-compose logs -f backend
curl http://localhost/health
```

### Option B: Manual Deploy

#### Backend
```bash
cd backend
npm install --production
cp .env.example .env  # แก้ไขค่า
node app.js
# หรือใช้ PM2:
npm install -g pm2
pm2 start app.js --name sakunna-gas-api
pm2 save && pm2 startup
```

#### Frontend (build แล้ว serve static)
```bash
# Customer LIFF
npm run build:customer
# Copy dist/ ไปไว้ใน nginx/apache

# Admin
npm run build:admin
# Copy admin/dist/ ไปที่ /admin path

# Driver
npm run build:driver
# Copy driver/dist/ ไปที่ /driver path
```

## LINE LIFF Setup

1. ไปที่ LINE Developers Console
2. เปิด Channel > LIFF tab
3. Add LIFF app:
   - **Size:** Full
   - **Endpoint URL:** `https://your-domain.com/` (Customer app URL)
   - **Scope:** profile, openid
4. คัดลอก LIFF ID ไปใส่ใน `.env`
5. ตั้งค่า Webhook URL: `https://your-domain.com/webhook/line`

## Nginx Config (HTTPS)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # ... (เนื้อหาจาก nginx.conf)
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

## URL Structure

| URL | หน้า |
|-----|------|
| `https://your-domain.com/` | Customer LIFF |
| `https://your-domain.com/admin` | Admin Dashboard |
| `https://your-domain.com/driver` | Driver App |
| `https://your-domain.com/api/v1` | Backend API |

## ความปลอดภัย Production

- [ ] เปลี่ยน `JWT_SECRET` เป็น random string ยาวๆ (32+ chars)
- [ ] ตั้งค่า CORS ให้รับเฉพาะ domain จริง
- [ ] จำกัด Google Maps API Key ด้วย HTTP Referrer
- [ ] เปิด HTTPS เสมอ (LINE LIFF บังคับ HTTPS)
- [ ] Backup Database สม่ำเสมอ

## Test Credentials (Seed Data)

| Role   | Email                     | Password      |
|--------|---------------------------|---------------|
| Admin  | admin@sakunngas.com       | Admin@1234    |
| Driver | driver1@sakunngas.com     | Driver@1234   |
| Driver | driver2@sakunngas.com     | Driver@1234   |
