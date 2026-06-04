# สกุณาแก๊ส — ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐          ┌───────────────────────┐
│     USERS        │          │      CUSTOMERS        │
│ (Admin + Driver) │          │                       │
├──────────────────┤          ├───────────────────────┤
│ id (PK)          │          │ id (PK)               │
│ name             │          │ line_user_id (UQ)     │
│ email (UQ)       │          │ name                  │
│ phone            │          │ phone                 │
│ password_hash    │          │ picture_url           │
│ role             │          │ total_orders          │
│ is_active        │          └──────────┬────────────┘
│ last_location    │                     │ 1
└────────┬─────────┘                     │
         │ 1                             │ N
         │ N                    ┌────────▼────────────┐
         │                      │ DELIVERY_ADDRESSES  │
         │                      ├─────────────────────┤
         │                      │ id (PK)             │
         │                      │ customer_id (FK)    │
         │                      │ label               │
         │                      │ address             │
         │                      │ lat, lng            │
         │                      │ is_default          │
         │                      └─────────────────────┘
         │
         │                      ┌───────────────────────┐
         │              ┌───────│         ORDERS        │───────┐
         │              │       ├───────────────────────┤       │
         └──────────────│──────>│ id (PK)               │       │
            driver_id   │       │ order_number (UQ)     │       │
                        │       │ customer_id (FK)      │       │
                        │       │ driver_id (FK)        │       │
                        │       │ brand_id (FK)         │       │
                        │       │ product_id (FK)       │       │
                        │       │ discount_code_id (FK) │       │
                        │       │ qty                   │       │
                        │       │ unit_price            │       │
                        │       │ subtotal              │       │
                        │       │ delivery_fee          │       │
                        │       │ discount_amount       │       │
                        │       │ total                 │       │
                        │       │ customer_name         │       │
                        │       │ customer_phone        │       │
                        │       │ delivery_address      │       │
                        │       │ delivery_lat/lng      │       │
                        │       │ distance_km           │       │
                        │       │ zone                  │       │
                        │       │ customer_type         │       │
                        │       │ payment_method        │       │
                        │       │ slip_url              │       │
                        │       │ note                  │       │
                        │       │ status                │       │
                        │       │ estimated_minutes     │       │
                        │       │ is_off_hours          │       │
                        │       └───────────────────────┘       │
                        │                   │                    │
                        │                   │ 1                  │
                        │                   │ N                  │
                        │       ┌───────────▼─────────┐         │
                        │       │  ORDER_STATUS_LOGS  │         │
                        │       ├─────────────────────┤         │
                        │       │ id (PK)             │         │
                        │       │ order_id (FK)       │         │
                        │       │ status              │         │
                        │       │ note                │         │
                        │       │ changed_by (FK)     │         │
                        │       └─────────────────────┘         │
                        │                                        │
┌───────────────┐        │       ┌─────────────────────┐         │
│    BRANDS     │        │       │      PRODUCTS       │         │
├───────────────┤        │       ├─────────────────────┤         │
│ id (PK)       ├────────┘       │ id (PK)             ├─────────┘
│ name          │ brand_id       │ name                │ product_id
│ logo_url      │                │ kg                  │
│ color         │                │ home_price          │
│ bg_color      │                │ description         │
│ is_active     │                │ is_hot              │
│ sort_order    │                │ is_active           │
└───────────────┘                │ sort_order          │
                                 └──────────┬──────────┘
                                            │ 1
                                            │ N
                                 ┌──────────▼──────────┐
                                 │ PRODUCT_ZONE_PRICES │
                                 ├─────────────────────┤
                                 │ id (PK)             │
                                 │ product_id (FK)     │
                                 │ zone_id (FK)        │◄──────────┐
                                 │ price               │           │
                                 └─────────────────────┘           │
                                                                    │
                                 ┌───────────────────────┐          │
                                 │    DELIVERY_ZONES     │          │
                                 ├───────────────────────┤          │
                                 │ id (PK)               ├──────────┘
                                 │ name (A, B, C...)     │
                                 │ label                 │
                                 │ max_km                │
                                 │ delivery_fee          │
                                 │ color                 │
                                 │ is_active             │
                                 └───────────────────────┘

                                 ┌───────────────────────┐
                                 │    DISCOUNT_CODES     │
                                 ├───────────────────────┤
                                 │ id (PK)               │
                                 │ code (UQ)             │
                                 │ type (fixed/percent)  │
                                 │ value                 │
                                 │ min_order_amount      │
                                 │ max_uses              │
                                 │ used_count            │
                                 │ expires_at            │
                                 │ allowed_zones[]       │
                                 │ is_active             │
                                 │ description           │
                                 └───────────────────────┘
```

## ความสัมพันธ์

| Relation | Type | Description |
|----------|------|-------------|
| Customer → DeliveryAddress | 1:N | ลูกค้าหนึ่งคนมีได้หลายที่อยู่ |
| Customer → Order | 1:N | ลูกค้าหนึ่งคนสั่งได้หลายครั้ง |
| Brand → Order | 1:N | หนึ่งยี่ห้อมีได้หลายออเดอร์ |
| Product → Order | 1:N | หนึ่งสินค้ามีได้หลายออเดอร์ |
| Product → ProductZonePrice | 1:N | หนึ่งสินค้ามีราคาหลายโซน |
| DeliveryZone → ProductZonePrice | 1:N | หนึ่งโซนมีราคาสินค้าหลายรายการ |
| Order → OrderStatusLog | 1:N | หนึ่งออเดอร์มีประวัติสถานะหลายรายการ |
| User(driver) → Order | 1:N | พนักงานหนึ่งคนรับงานได้หลายออเดอร์ |
| DiscountCode → Order | 1:N | หนึ่งโค้ดใช้ได้กับหลายออเดอร์ |
