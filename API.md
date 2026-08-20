# Backend API Reference — Services Booking App

**Base URL (live on Render):** `https://services-booking-backend-3wbl.onrender.com`

All requests/responses are JSON. All endpoints (except auth/register, auth/login, and public list views) require a Bearer token.

---

## 1. Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account. Body: `{name, email, password, phone, role?}` |
| POST | `/api/auth/login` | No | Body: `{email, password}` → returns `accessToken`, `refreshToken`, `user` |
| POST | `/api/auth/refresh-token` | No | Body: `{refreshToken}` → returns new `accessToken` |
| POST | `/api/auth/logout` | Yes | Logout |
| GET | `/api/auth/me` | Yes | Current user profile |
| PUT | `/api/auth/update-profile` | Yes | Update `{name, phone, profile_image?}` |
| PUT | `/api/auth/change-password` | Yes | Body: `{oldPassword, newPassword}` |

**Login/register response shape:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "name": "...", "email": "...", "role": "customer" }
}
```

**Auth header for every protected request:**
```
Authorization: Bearer <accessToken>
```

**Roles:** `customer` (books services), `provider` (offers services), `admin` (manage app).

---

## 2. Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | No | List all categories |

---

## 3. Services

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/services` | No | List services. Filters: `?category=`, `?search=`, `?min_price=`, `?max_price=`, `?page=`, `?limit=` |
| GET | `/api/services/:id` | No | Service details (includes provider info) |
| GET | `/api/services/provider/:providerId` | No | A provider's services |
| POST | `/api/services` | provider | Create. Body: `{name, price, duration, category, description?}` |
| PUT | `/api/services/:id` | provider | Update own service |
| DELETE | `/api/services/:id` | provider | Deactivate own service |

---

## 4. Providers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/providers` | No | List. Filters: `?category=`, `?verified=`, `?page=` |
| GET | `/api/providers/:id` | No | Provider + user + services |
| GET | `/api/providers/nearby` | Yes | `?lat=`, `?lng=`, `?radius=` (km) |
| POST | `/api/providers` | provider | Register as provider. Body: `{business_name, description?, category?}` |
| PUT | `/api/providers/:id` | provider | Update own profile |
| PUT | `/api/providers/:id/status` | provider | Toggle `{is_online: true/false}` |

---

## 5. Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings` | customer | Body: `{provider_id, service_id, booking_time, address, notes?, location_lat?, location_lng?}` |
| GET | `/api/bookings` | Yes | List own bookings (role-aware) |
| GET | `/api/bookings/:id` | Yes | Booking + customer + provider + service + payment |
| GET | `/api/bookings/customer/:customerId` | Yes | Customer's booking history |
| GET | `/api/bookings/provider/:providerId` | Yes | Provider's bookings |
| PUT | `/api/bookings/:id/status` | Yes | Body: `{status}` — see statuses below |
| PUT | `/api/bookings/:id/cancel` | Yes | Cancel (only when pending/accepted) |

**Booking status flow:**
```
pending → accepted → in-progress → completed → paid
pending → rejected
pending → expired (auto after 15 min)
pending/accepted → cancelled
```

---

## 6. Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/initialize` | customer | Body: `{booking_id, payment_method}` → payment URL/ref |
| POST | `/api/payments/verify` | Yes | Body: `{transaction_ref}` → verify status |
| GET | `/api/payments/booking/:bookingId` | Yes | Payments for a booking |
| POST | `/api/payments/webhook` | No | Payment gateway callback (set URL to your live endpoint) |

---

## 7. Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/reviews` | customer | Body: `{booking_id, rating (1-5), comment?}` |
| GET | `/api/reviews/provider/:providerId` | No | Reviews + avg rating for a provider |
| GET | `/api/reviews/:id` | No | Review details |
| DELETE | `/api/reviews/:id` | Yes | Author or admin |

---

## 8. Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Yes | List (newest first, paginated) |
| GET | `/api/notifications/unread-count` | Yes | `{count}` |
| PUT | `/api/notifications/:id/read` | Yes | Mark one read |
| PUT | `/api/notifications/read-all` | Yes | Mark all read |
| DELETE | `/api/notifications/:id` | Yes | Delete one |

---

## 9. Locations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PUT | `/api/locations/provider` | provider | Body: `{latitude, longitude, booking_id?}` — update live location |
| GET | `/api/locations/booking/:bookingId` | Yes | Location history for a booking |
| POST | `/api/locations/calculate-distance` | No | Body: `{lat1, lng1, lat2, lng2}` → `{distance_km}` |

---

## 10. Admin (role: admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/providers` | All providers |
| PUT | `/api/admin/providers/:id/verify` | Verify a provider |
| GET | `/api/admin/bookings` | All bookings |
| GET | `/api/admin/analytics` | Revenue, bookings, users counts |
| GET | `/api/admin/reports` | Trends + provider performance |

---

## Real-time (Socket.IO)

**Connect to:** `wss://services-booking-backend-3wbl.onrender.com`
**Auth:** pass JWT in the connection:
```js
io.connect(url, { auth: { token: accessToken } });
```

**Events to emit (client → server):**
| Event | Payload | Who |
|-------|---------|-----|
| `join-booking` | `{bookingId}` | customer/provider |
| `leave-booking` | `{bookingId}` | customer/provider |
| `location-update` | `{bookingId, latitude, longitude}` | provider |
| `booking-action` | `{bookingId, action}` | provider |

**Events to listen (server → client):**
| Event | Payload |
|-------|---------|
| `provider-location` | `{providerId, latitude, longitude, timestamp}` |
| `booking-status-update` | `{bookingId, action, updatedBy, timestamp}` |
| `notification` | notification object |

---

## Error format
```json
{
  "message": "Description of error",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```
- `400` validation error, `401` not authenticated/expired, `403` wrong role, `404` not found, `409` duplicate, `500` server error.

## Quick test with curl
```bash
# register
curl -X POST https://services-booking-backend-3wbl.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"password123"}'

# health
curl https://services-booking-backend-3wbl.onrender.com/api/health
```
