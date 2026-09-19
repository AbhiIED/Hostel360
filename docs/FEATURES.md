# HOSTEL360 — Feature Checklist

> Ordered, phased checklist. Each phase must be fully checked off and demo-tested
> before the next phase begins. After completing each checkbox, tick it here AND
> update `/docs/PROGRESS.md`.

---

## Phase 1 — Project Scaffold

> **Done means**: the repo is structured, the DB schema exists, migrations run
> cleanly, the Express server starts, and the React shell renders without errors.

- [x] **1.1 Repo structure** — `/backend` and `/frontend` directories created; root-level `README.md` with setup instructions; `.gitignore` covers `node_modules`, `.env`, `dist`, `build`.
- [x] **1.2 Backend init** — `package.json` initialized in `/backend`; dependencies installed: `express`, `prisma`, `@prisma/client`, `jsonwebtoken`, `bcrypt`, `dotenv`, `cors`, `helmet`, `socket.io`, `express-rate-limit`, `node-cron`, `uuid`, `zod`.
- [x] **1.3 Env config** — `/backend/.env.example` created with all required keys (`DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `QR_TTL_SECONDS`, `PORT`, `FRONTEND_URL`); `.env` is git-ignored.
- [x] **1.4 Prisma schema** — `schema.prisma` defines all 13 models (`User`, `Student`, `Hostel`, `Room`, `Gate`, `Device`, `Mess`, `MealWindow`, `QrToken`, `HostelAttendance`, `MessAttendance`, `RefreshToken`, `AuditLog`) with all columns, enums, relations, and indexes matching ARCHITECTURE.md §4.
- [x] **1.5 Initial migration** — `prisma migrate dev --name init` runs without errors; tables created in MySQL.
- [x] **1.6 Seed script** — `/backend/prisma/seed.js` creates: 1 Super Admin, 2 Hostels, 4 Rooms each, 2 Gates each, 1 Mess (shared), 4 MealWindows, 5 Students with linked Users; `prisma db seed` runs successfully.
- [x] **1.7 Basic Express server** — `/backend/src/index.js` sets up Express with `cors`, `helmet`, `express.json()`; `GET /api/health` returns `{ status: 'ok', timestamp }`. Server starts with `npm run dev` (nodemon).
- [x] **1.8 Frontend init** — `/frontend` scaffolded with Vite + React + TypeScript; Tailwind CSS configured; `npm run dev` shows default page at `localhost:5173`.
- [x] **1.9 React shell** — `App.tsx` sets up `react-router-dom` with placeholder routes: `/app/*`, `/display/gate/:deviceId`, `/display/mess/:deviceId`, `/dashboard/*`; a nav bar shows active route.

---

## Phase 2 — Authentication

> **Done means**: a user can log in, receive access + refresh tokens, use the access token
> to call a protected endpoint, and rotate tokens via refresh. All RBAC roles are enforced.

- [x] **2.1 User login endpoint** — `POST /api/auth/login` accepts `{ email, password }`, verifies bcrypt hash, returns `{ accessToken, refreshToken, user }`. Returns 401 on bad credentials.
- [x] **2.2 JWT access token** — 15-minute HS256 token with payload `{ sub, role, iat, exp }` signed by `ACCESS_TOKEN_SECRET`. Verified by `authenticate` middleware.
- [x] **2.3 Refresh token issuance** — On login, a cryptographically random 32-byte refresh token is generated; its SHA-256 hash is stored in `refresh_tokens` with a 7-day expiry; the raw token is returned to the client.
- [x] **2.4 Token refresh endpoint** — `POST /api/auth/refresh` accepts `{ refreshToken }`, validates hash exists and is not revoked/expired, issues new access + refresh pair, revokes old refresh token. Detects reuse (revoked token presented → revoke all user tokens).
- [x] **2.5 Logout endpoint** — `POST /api/auth/logout` revokes the current refresh token; requires valid access token.
- [x] **2.6 RBAC middleware** — `authorize(roles[])` middleware; attaches decoded user to `req.user`; returns 403 if role not permitted. Applied to all protected routes.
- [x] **2.7 Login rate limiting** — `express-rate-limit` on `POST /api/auth/login`: 10 req/min per IP; returns 429 on breach.
- [x] **2.8 Frontend auth flow** — Login page (`/login`) with email/password form; stores access token in memory (React context) and refresh token in `httpOnly` cookie or localStorage; `axios` interceptor auto-refreshes on 401; protected route wrapper redirects unauthenticated users to `/login`.
- [x] **2.9 Audit log — login/logout** — `USER_LOGIN` and `USER_LOGOUT` entries written to `audit_logs` on each event.

---

## Phase 3 — Device Authentication

> **Done means**: a Super Admin can register a device and get a one-time secret; the device
> can authenticate with that secret on every request; disabling a device gives it 401 instantly.

- [x] **3.1 Device registration endpoint** — `POST /api/devices/register` (SUPER_ADMIN); creates `devices` row, generates 32-byte random secret, returns plaintext secret once (never again); stores bcrypt hash in `secret_hash`.
- [x] **3.2 Device list endpoint** — `GET /api/devices` (SUPER_ADMIN); returns all devices with `last_heartbeat_at`, `is_active`, linked gate/mess info.
- [ ] **3.3 `authenticateDevice` middleware** — Reads `Authorization: Bearer <secret>` header; looks up device by brute-force search (or device-id header hint); verifies bcrypt; checks `is_active`; returns 401 if inactive or secret wrong; attaches `req.device`.
- [ ] **3.4 Heartbeat endpoint** — `POST /api/devices/heartbeat` (device auth); updates `devices.last_heartbeat_at` to NOW(); returns `{ ok: true }`.
- [ ] **3.5 Disable device endpoint** — `PATCH /api/devices/:id/disable` (SUPER_ADMIN); sets `is_active = false`; bulk-updates all `UNUSED` QR tokens for that device to `REVOKED`; emits `device:alert` Socket.IO event to `admin:global`.
- [ ] **3.6 Audit log — device events** — `DEVICE_REGISTERED` and `DEVICE_DISABLED` entries written to `audit_logs`.
- [ ] **3.7 Admin UI — device management** — Dashboard page listing devices (name, purpose, linked gate/mess, last heartbeat, status); button to register new device (shows one-time secret in modal); button to disable/revoke.

---

## Phase 4 — Core CRUD

> **Done means**: a Super Admin can create/read/update/delete students, hostels, rooms,
> gates, messes, and meal windows through both the API and the admin dashboard UI.

- [ ] **4.1 Hostels API** — `GET/POST /api/hostels`, `GET/PATCH/DELETE /api/hostels/:id` (SUPER_ADMIN); Zod validation; returns 404 on missing.
- [ ] **4.2 Rooms API** — `GET/POST /api/hostels/:id/rooms` (SUPER_ADMIN); room_number unique within hostel enforced.
- [ ] **4.3 Gates API** — `GET/POST /api/hostels/:id/gates` (SUPER_ADMIN).
- [ ] **4.4 Messes API** — `GET/POST /api/messes`, `GET/PATCH/DELETE /api/messes/:id` (SUPER_ADMIN).
- [ ] **4.5 Meal Windows API** — `GET/POST /api/messes/:id/meal-windows`, `PATCH /api/messes/:id/meal-windows/:wid` (SUPER_ADMIN, MESS_ADMIN); start_time/end_time validated.
- [ ] **4.6 Students API** — `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id` (SUPER_ADMIN / WARDEN read); `POST` also creates linked `users` row with role STUDENT and hashed temp password.
- [ ] **4.7 Dashboard — Hostels & Rooms UI** — CRUD pages in dashboard for hostels and rooms; table view with inline edit/delete.
- [ ] **4.8 Dashboard — Students UI** — Student list with search/filter; create student form (assigns hostel, room); edit modal; current_state badge visible.
- [ ] **4.9 Dashboard — Messes & Meal Windows UI** — CRUD pages for messes; meal window table with time range and active toggle.

---

## Phase 5 — QR Token Service

> **Done means**: a device can poll for a fresh QR token; the token encodes no identity;
> the token expires in TTL seconds; the background sweeper marks expired tokens.

- [ ] **5.1 QR issue endpoint** — `GET /api/display/qr` (device auth); generates 32-byte random opaque token; stores SHA-256 hash + device metadata in `qr_tokens`; returns `{ token: "<raw>", expiresAt, purpose, deviceId }`.
- [ ] **5.2 Token TTL** — `expires_at = NOW() + QR_TTL_SECONDS` (default 20 s); `QR_TTL_SECONDS` from env.
- [ ] **5.3 Token state machine** — `validateAndConsume(rawToken, deviceId)` service function: hash the raw token; find by hash; assert status=UNUSED, expires_at > NOW(), device_id matches; set status=USED + used_at in transaction; throw typed errors (INVALID, EXPIRED, USED, DEVICE_MISMATCH).
- [ ] **5.4 Background sweeper** — `node-cron` job every 60 s: bulk-update `qr_tokens` WHERE `status='UNUSED' AND expires_at < NOW()` to `status='EXPIRED'`. Logged to console.
- [ ] **5.5 Kiosk QR display (frontend)** — `/display/gate/:deviceId` page: device authenticates with secret (entered once on kiosk setup); polls `GET /api/display/qr` every `TTL - 2` seconds; renders QR code of raw token; shows countdown timer; listens on Socket.IO `device:<deviceId>` room for `display:confirm` event.

---

## Phase 6 — Hostel ENTRY/EXIT Flow

> **Done means**: a student scans a QR at the gate; the backend validates the token,
> determines direction (ENTRY/EXIT based on current_state), records attendance atomically,
> updates current_state; the kiosk flashes name/photo; the warden dashboard live-updates.

- [ ] **6.1 Scan endpoint** — `POST /api/attendance/scan` (STUDENT); body: `{ token: "<raw>" }`; validate token via service from §5.3; branch on `qr_tokens.purpose`.
- [ ] **6.2 Hostel scan branch** — For purpose=GATE: derive direction from `student.current_state` (INSIDE → EXIT, OUTSIDE → ENTRY); write `hostel_attendance` row + update `students.current_state` in single Prisma transaction with the token status update.
- [ ] **6.3 Scan rate limiting** — `express-rate-limit` on `POST /api/attendance/scan`: 5 req/min per JWT sub (student ID).
- [ ] **6.4 Socket.IO — attendance event** — After transaction commits, emit `attendance:new` to `hostel:<hostelId>` with student snapshot + new occupancy count; emit `display:confirm` to `device:<deviceId>` with name + photo.
- [ ] **6.5 Kiosk confirmation flash** — On `display:confirm` event, the kiosk gate UI overlays the student name + photo for 5 s with a green/red ENTRY/EXIT badge, then returns to QR display. This is always rendered — cannot be bypassed.
- [ ] **6.6 Scan audit log** — `HOSTEL_SCAN_SUCCESS` or `HOSTEL_SCAN_FAIL` written to `audit_logs` for every attempt.
- [ ] **6.7 Student App — scan UI** — `/app/scan` page: camera QR scanner (using `react-qr-reader` or similar); on scan, POSTs token; shows success card (direction, gate, timestamp) or error message.
- [ ] **6.8 Student App — self history** — `GET /api/me`, `GET /api/me/hostel-history`; renders own entry/exit log as timeline.

---

## Phase 7 — Mess Attendance Flow

> **Done means**: a student scans a mess QR; the backend resolves the active meal window,
> prevents duplicate scans, records attendance; the mess display flashes confirmation;
> the mess dashboard live-updates.

- [ ] **7.1 Meal window resolver** — Service function: given `mess_id` + current time, finds the active `meal_window` where `start_time <= now <= end_time` and `is_active = true`; returns null if none.
- [ ] **7.2 Mess scan branch** — For purpose=MESS: resolve meal window; reject if no active window; check unique constraint `(student_id, meal_window_id, date)` before insert; write `mess_attendance` row + token status=USED in Prisma transaction.
- [ ] **7.3 Duplicate prevention** — DB unique constraint on `mess_attendance(student_id, meal_window_id, date)`; app-layer check first; returns 409 CONFLICT with "already marked for this meal" message.
- [ ] **7.4 Socket.IO — mess event** — After commit, emit `mess:attendance:new` to `mess:<messId>` with student snapshot + updated daily count; emit `display:confirm` to `device:<deviceId>`.
- [ ] **7.5 Mess kiosk UI** — `/display/mess/:deviceId`; same polling + QR display as gate kiosk; `display:confirm` overlay shows meal type badge + student name/photo for 5 s.
- [ ] **7.6 Mess scan audit log** — `MESS_SCAN_SUCCESS` or `MESS_SCAN_FAIL` written to `audit_logs`.
- [ ] **7.7 Student App — mess history** — `GET /api/me/mess-history`; renders own meal log (date, meal type, mess name).

---

## Phase 8 — Real-Time Dashboards

> **Done means**: all three dashboard personas (Warden, Mess Admin, Super Admin) see live
> data without page refresh; Socket.IO rooms deliver events correctly.

- [ ] **8.1 Socket.IO server setup** — `socket.io` attached to HTTP server; authentication middleware on connection (validates JWT or device secret from handshake auth); clients join correct rooms after auth.
- [ ] **8.2 Warden dashboard — live feed** — `/dashboard/warden`; Socket.IO joins `hostel:<hostelId>` room; live event list showing last 50 entries/exits; auto-scrolls on new event.
- [ ] **8.3 Warden dashboard — occupancy panel** — Shows current occupancy count per hostel (from `GET /api/attendance/hostel/occupancy`); updates in real-time on `attendance:new` event.
- [ ] **8.4 Mess Admin dashboard — live feed** — `/dashboard/mess`; joins `mess:<messId>` room; live meal scan feed showing student name, meal type, timestamp.
- [ ] **8.5 Mess Admin dashboard — daily counts** — Shows count per meal type for today (from `GET /api/attendance/mess/counts`); updates on `mess:attendance:new` event.
- [ ] **8.6 Super Admin dashboard** — `/dashboard/admin`; joins `admin:global` room; device heartbeat/alert feed; summary cards (total students, current occupancy all hostels, today's total meals); links to CRUD pages.
- [ ] **8.7 Attendance history pages** — Paginated, filterable tables: hostel attendance log (filter: hostel, date range, direction); mess attendance log (filter: mess, date, meal_type).

---

## Phase 9 — Security Hardening

> **Done means**: rate limits are active and tested; refresh token rotation with reuse
> detection works; audit logs are written for all sensitive actions; device revocation
> is instant.

- [ ] **9.1 Refresh token reuse detection** — When a revoked refresh token is presented, all refresh tokens for that user are wiped; tested with a simulated replay attack.
- [ ] **9.2 Scan rate limit verified** — Manual test: 6 rapid scans from same student JWT → 5th succeeds, 6th returns 429.
- [ ] **9.3 Device revocation instant** — Test: disable device → device's next heartbeat returns 401; existing UNUSED tokens for that device are REVOKED in DB.
- [ ] **9.4 Audit log completeness check** — Verify all 8 audit action types are written correctly by running through each flow and querying `audit_logs`.
- [ ] **9.5 RBAC edge cases** — Test: STUDENT trying to call `/api/students` → 403; WARDEN trying to call `/api/devices/register` → 403; MESS_ADMIN trying to disable a device → 403.
- [ ] **9.6 Input validation hardening** — All endpoints use Zod schemas; malformed requests return 400 with structured error; no stack traces in production responses.
- [ ] **9.7 CORS and Helmet hardened** — `cors` restricted to `FRONTEND_URL`; `helmet` configured; `X-Powered-By` removed.

---

## Phase 10 — Analytics and Reports

> **Done means**: wardens and admins can view occupancy trends and meal trends with date
> filters; Super Admin can export data as CSV.

- [ ] **10.1 Occupancy history API** — `GET /api/analytics/occupancy-history?hostelId=&from=&to=` aggregates entry/exit counts per hour/day; returns time-series data.
- [ ] **10.2 Meal trends API** — `GET /api/analytics/meal-trends?messId=&from=&to=` returns daily counts per meal_type; usable for charts.
- [ ] **10.3 Export API** — `GET /api/analytics/export?type=hostel|mess&from=&to=` (SUPER_ADMIN); streams CSV response.
- [ ] **10.4 Occupancy history chart UI** — Line/bar chart on warden dashboard (using Recharts or Chart.js); date range picker.
- [ ] **10.5 Meal trends chart UI** — Bar chart on mess admin dashboard showing meal counts per day, grouped by meal type; date range picker.
- [ ] **10.6 Export button UI** — Dashboard button triggers CSV download via fetch + blob URL.

---

## Phase 11 — Testing and Deployment

> **Done means**: API test suite passes; a fresh `docker compose up` brings the whole system
> up with seeded data; the system is demo-ready.

- [ ] **11.1 Jest + Supertest setup** — Test runner configured in `/backend`; test DB (SQLite or separate MySQL DB) configured via `DATABASE_URL_TEST`.
- [ ] **11.2 Auth endpoint tests** — Unit/integration tests for login, refresh, logout, RBAC, reuse detection.
- [ ] **11.3 QR token service tests** — Unit tests for `validateAndConsume`: expired token, used token, device mismatch, valid token.
- [ ] **11.4 Scan endpoint tests** — Integration tests for hostel scan (ENTRY/EXIT state machine) and mess scan (duplicate prevention).
- [ ] **11.5 Seed/demo script** — `/backend/prisma/seed.js` enhanced to create a full demo dataset: multiple scan events across dates, realistic meal attendance, so dashboards are non-empty after seed.
- [ ] **11.6 Dockerfile — backend** — Multi-stage Dockerfile for `/backend`; runs migrations then starts server.
- [ ] **11.7 Dockerfile — frontend** — Vite build → nginx serve.
- [ ] **11.8 docker-compose.yml** — Orchestrates: MySQL 8, backend, frontend; health checks; `depends_on` ordering; `.env` via `env_file`.
- [ ] **11.9 Final walkthrough** — `docker compose up` from scratch; run seed; demo all four UIs; confirm real-time events flow end-to-end; README updated with exact commands.
