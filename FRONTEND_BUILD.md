# Services Booking App — Flutter Frontend Build Prompt

> Feed this document (plus `API.md`) to your coding agent to build the frontend.
> This app is a cross-platform mobile app (Android + iOS) using **Flutter** — NOT a web app.

---

## 1. Project Overview

A **services booking app** (like a gig-platform for plumbing, electrical, cleaning, etc.) with two user types:

- **Customer** — browses services, books a provider, tracks the provider on a map, pays, reviews
- **Provider** — accepts/rejects booking requests, navigates to the customer, updates live location, manages services & earnings
- **Admin** (optional phase) — dashboard, verify providers, view analytics

The backend is **already built, deployed, and live**. You are building ONLY the Flutter mobile app that consumes it.

---

## 2. Backend Connection (IMPORTANT)

**Base URL:** `https://services-booking-backend-3wbl.onrender.com`

| Protocol | URL | Used for |
|----------|-----|----------|
| REST API | `https://services-booking-backend-3wbl.onrender.com/api` | All CRUD (JSON) |
| Socket.IO | `wss://services-booking-backend-3wbl.onrender.com` | Real-time (location, booking status, notifications) |
| Health check | `https://services-booking-backend-3wbl.onrender.com/api/health` | Returns `{"status":"ok"}` |

**Read `API.md` in the backend repo for the FULL endpoint reference.** Summary:

### Auth flow
1. `POST /api/auth/register` or `POST /api/auth/login`
2. Response: `{ accessToken, refreshToken, user }`
3. Store tokens in **flutter_secure_storage** (never shared_preferences)
4. Send `Authorization: Bearer <accessToken>` on every protected request
5. When access token expires → `POST /api/auth/refresh-token` with refresh token → get new access token
6. Auto-login: if tokens exist, validate via `GET /api/auth/me`, redirect by role

### Roles (from `user.role`)
- `customer` → Customer app screens
- `provider` → Provider app screens
- `admin` → Admin screens (optional)

### Key endpoints (see API.md for full list + payloads)
- Categories: `GET /api/categories`
- Services: `GET /api/services`, `GET /api/services/:id`
- Providers: `GET /api/providers`, `GET /api/providers/nearby?lat=&lng=&radius=`, `GET /api/providers/:id`
- Bookings: `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/:id`, `PUT /api/bookings/:id/status`, `PUT /api/bookings/:id/cancel`
- Payments: `POST /api/payments/initialize`, `POST /api/payments/verify`, `GET /api/payments/booking/:bookingId`
- Reviews: `POST /api/reviews`, `GET /api/reviews/provider/:providerId`
- Notifications: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`
- Locations: `PUT /api/locations/provider`, `GET /api/locations/booking/:bookingId`, `POST /api/locations/calculate-distance`

### Booking status flow (used for UI badges/actions)
```
pending → accepted → in-progress → completed → paid
pending → rejected
pending → expired (auto after 15 min)
pending/accepted → cancelled
```

### Socket.IO events
```dart
// Connect with JWT
socket = IO.io(baseUrl, IO.OptionBuilder()
  .setTransports(['websocket'])
  .setAuth({'token': accessToken})
  .enableReconnection()
  .build());

// Emit
socket.emit('join-booking', {'bookingId': id});
socket.emit('leave-booking', {'bookingId': id});
socket.emit('location-update', {'bookingId': id, 'latitude': lat, 'longitude': lng}); // provider
socket.emit('booking-action', {'bookingId': id, 'action': 'accept'}); // provider

// Listen
socket.on('provider-location', (data) => {...});       // {providerId, latitude, longitude, timestamp}
socket.on('booking-status-update', (data) => {...});   // {bookingId, action, updatedBy, timestamp}
socket.on('notification', (data) => {...});
```

### Error format (from backend)
```json
{ "message": "Description", "errors": [{ "field": "email", "message": "Invalid email" }] }
```
- `400` validation, `401` not authenticated/expired, `403` wrong role, `404` not found, `409` duplicate, `500` server error.

---

## 3. Tech Stack (recommended)

| Concern | Package |
|---------|---------|
| HTTP client | `dio` + `dio/io.dart` (with interceptors for token + refresh) |
| State management | `provider` (simplest) or `flutter_riverpod` or `bloc` — pick ONE, be consistent |
| Dependency injection | `get_it` |
| Routing | `go_router` (role-based redirects) or named routes |
| Secure storage | `flutter_secure_storage` (JWT tokens) |
| Local storage | `shared_preferences` (non-sensitive prefs) |
| Maps | `google_maps_flutter` |
| Geolocation | `geolocator` |
| Geo autocomplete | `google_places_autocomplete` or Google Places API via backend proxy |
| Realtime | `socket_io_client` |
| Push notifications | `firebase_core` + `firebase_messaging` + `flutter_local_notifications` |
| Image picking | `image_picker` |
| Image upload | `dio` multipart (backend uses Cloudinary — or send URL strings for now) |
| State (extra) | `hive`/`drift` for offline caching (optional) |

> Note: Backend file-upload env keys (Cloudinary) are not set yet. For now, the frontend can send image **URL strings** in fields. Image picking UI can be built; wiring upload happens later.

---

## 4. Project Structure

```
lib/
├── main.dart
├── app.dart
├── config/
│   ├── api_config.dart        # base URLs, keys
│   └── theme.dart             # colors, typography
├── models/                    # JSON models matching backend
│   ├── user.dart
│   ├── provider.dart
│   ├── service.dart
│   ├── booking.dart
│   ├── payment.dart
│   ├── review.dart
│   ├── notification.dart
│   ├── category.dart
│   └── location.dart
├── services/                  # API service layer
│   ├── dio_client.dart        # Dio + interceptors (token, refresh, error)
│   ├── auth_service.dart
│   ├── provider_service.dart
│   ├── service_service.dart
│   ├── booking_service.dart
│   ├── payment_service.dart
│   ├── review_service.dart
│   ├── notification_service.dart
│   ├── category_service.dart
│   ├── location_service.dart
│   └── socket_service.dart    # Socket.IO wrapper (connect, rooms, events)
├── providers/                 # state management
│   ├── auth_provider.dart
│   ├── booking_provider.dart
│   ├── location_provider.dart
│   ├── notification_provider.dart
│   └── ui_provider.dart
├── screens/
│   ├── auth/                  # splash, onboarding, login, register, otp, forgot
│   ├── customer/              # home, service list, service detail, booking, tracking, payment, profile
│   ├── provider/              # dashboard, requests, navigation, earnings, reviews, profile
│   └── admin/                 # dashboard, users, providers, bookings, reports
├── widgets/                   # shared: AppBar, bottom nav, loading, error, buttons, inputs, dropdowns
├── utils/                     # formatters, validators, constants
└── routes/
    ├── app_router.dart        # go_router with role guards
    └── route_names.dart
```

---

## 5. Build Phases (from original spec)

### Phase 1: Project Setup & Navigation
- Init Flutter project with structure above
- Named routes or go_router with **role-based routing** (customer vs provider)
- Theme config (colors, typography)
- Shared widgets: AppBar, bottom nav, loading indicator, error widget, custom buttons, input fields, dropdowns
- GetIt DI setup
- `api_config.dart` with `API_BASE_URL = 'https://services-booking-backend-3wbl.onrender.com/api'` and `SOCKET_URL = 'https://services-booking-backend-3wbl.onrender.com'`
- Dio client with interceptors: attach Bearer token, auto-refresh on 401, user-friendly error messages, retry logic

### Phase 2: Authentication Screens
- Splash (logo + loading, checks stored token → route by role)
- Onboarding (3 slides: intro, features, get started → login)
- Login (email/password, forgot password, role-aware redirect)
- Registration (name, email, phone, password, role selection)
- Provider registration (business details, documents, services — can start minimal)
- OTP verification (UI placeholder — backend email verification optional)
- Forgot password (UI placeholder — backend endpoint optional)
- AuthProvider: login/logout state, secure storage of JWT, auto-login, role-based redirect

### Phase 3: Customer App Screens
- **Home:** location bar (current location/enter address), category grid (Plumbing, Electrical, Cleaning...), featured providers, recent bookings, quick request button
- **Service selection:** category-based list, search/filter, service details (name, description, price, provider info), provider profiles with ratings/reviews
- **Booking:** service selection, date/time picker, location (map or address), special instructions, price estimate, confirm booking → `POST /api/bookings`
- **Tracking:** map with provider location (real-time via Socket.IO), ETA, provider info card, booking status badge, cancel option
- **Payment:** method selection, amount display, gateway integration (backend returns payment URL/ref → open in WebView), receipt after payment → `POST /api/payments/initialize`, `POST /api/payments/verify`
- **Profile:** user info, booking history, reviews given, payment methods, settings (notifications, privacy, logout)

### Phase 4: Provider App Screens
- **Dashboard:** earnings (today/week/month), booking stats, online/offline toggle → `PUT /api/providers/:id/status`, recent bookings, performance (rating, completion rate)
- **Requests:** incoming booking requests (real-time via Socket.IO), accept/reject buttons → `PUT /api/bookings/:id/status`, request details, countdown timer (15 min expiry)
- **Navigation:** map with route to customer, arrival confirm, start service, complete service → status updates + `PUT /api/locations/provider` location broadcasting
- **Earnings:** breakdown, transaction history, withdrawal options (UI), payment reports
- **Reviews:** customer ratings, comments, average rating, respond (optional)
- **Profile:** business info, services management (add/edit/delete → `/api/services`), working hours, service radius, verification docs, settings

### Phase 5: Map & Location Features
- Google Maps init (google_maps_flutter)
- Map in: customer home, tracking screen, provider navigation
- Custom markers (customer vs provider)
- Current location detection with permission handling (geolocator)
- Location search with autocomplete
- Provider location tracking (Socket.IO `provider-location` → animate marker)
- Route polyline between points
- Distance & ETA display (`/api/locations/calculate-distance`)
- Camera follow, zoom controls
- Widgets: LocationPicker, address autocomplete bar, map controls, info windows

### Phase 6: Real-time Communication
- Socket.IO service class: connect with JWT auth, reconnection logic, reconnect on token refresh
- Listen: provider location updates, booking status changes, incoming requests (provider), new notifications
- Emit: location updates (provider), booking actions (accept/reject/complete)
- UI updates: animated marker, status badges without refresh, request popup (provider), booking progress indicator

### Phase 7: Notifications & Payment Integration
- Firebase Cloud Messaging: configure in project, push notification handling, deep linking to screens, local notifications in background
- Notification screen: list, read/unread, clear, actions
- Payment: method selection UI, WebView for payment gateway, success/failure handling, receipt UI

### Phase 8: Admin Panel (optional)
- Dashboard with analytics (`/api/admin/analytics`)
- User management, provider management (verify), booking management, service management
- Reports (`/api/admin/reports`)
- Charts (fl_chart), data export, search/filter
- Admin role-based access

---

## 6. API Service Layer Pattern (examples)

```dart
// models/booking.dart
class Booking {
  final String id;
  final String status;
  final String bookingTime;
  final double totalAmount;
  // ... fields matching backend
  Booking.fromJson(Map<String, dynamic> json) { ... }
  Map<String, dynamic> toJson() { ... }
}

// services/auth_service.dart
class AuthService {
  final Dio _dio;
  Future<AuthResponse> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {email, password});
    return AuthResponse.fromJson(res.data);
  }
}

// dio_client.dart — interceptor adds token, on 401 calls refresh
class AuthInterceptor extends Interceptor {
  @override
  void onRequest(options, handler) {
    options.headers['Authorization'] = 'Bearer ${token}';
    handler.next(options);
  }
  @override
  void onError(DioException err, handler) {
    if (err.response?.statusCode == 401) { /* refresh & retry */ }
    handler.next(err);
  }
}
```

---

## 7. Test Accounts

| Role | Email | Password |
|------|-------|----------|
| customer | `customer@test.com` | `password123` |
| (any) | `rendertest@test.com` | `password123` |

Users can also register new accounts via the app (`POST /api/auth/register`). There is no admin account yet — ask backend owner to create one if admin testing is needed.

---

## 8. Integration Checklist (before shipping)

- [ ] Base URL configurable via env (dev vs prod)
- [ ] Token refresh flow works when access token expires
- [ ] 401 anywhere → never crash; redirect to login
- [ ] Socket.IO reconnects after network drop
- [ ] Booking status changes reflect on map + badges in real time
- [ ] Payment webhook URL points to backend (frontend only handles redirect + verify)
- [ ] Push notification taps navigate to the right screen
- [ ] Role guard blocks customer screens for providers and vice versa
- [ ] Loading/error/empty states on every screen