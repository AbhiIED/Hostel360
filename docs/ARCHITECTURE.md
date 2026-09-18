# HOSTEL360 — System Architecture

> Single source of truth. Update this file any time a foundational design decision changes,
> and record the change in `/docs/PROGRESS.md` under "Key Decisions Log".

---

## 1. System Summary

HOSTEL360 is a QR-based hostel and mess management platform. Fixed display devices mounted
at hostel gates and mess counters continuously rotate short-lived (15–30 s) dynamic QR codes.
A student opens the authenticated Student App, scans the on-screen QR, and the app posts the
opaque token to the backend. The backend validates the token (authenticity, TTL, one-time-use,
purpose, device binding), atomically records an attendance row and updates the student's
`current_state` in a single database transaction, then publishes a Socket.IO event to the
relevant hostel or mess room so every connected dashboard refreshes in real time. After a
successful scan the gate/mess display briefly flashes the scanning student's name and photo
as an on-site visual confirmation, preventing relay/proxy attacks.

---

## 2. Actors and Roles

| Role | Description | Auth mechanism |
|---|---|---|
| **Student** | Scans QR at gate or mess counter via the Student App | JWT (user login) |
| **Warden** | Monitors live hostel occupancy, views entry/exit feed, generates reports | JWT (user login) |
| **Mess Admin** | Monitors live meal counts, views attendance per meal window | JWT (user login) |
| **Super Admin** | Manages all entities: students, rooms, hostels, messes, devices, meal windows, users | JWT (user login) |
| **Display Device** | Kiosk/Raspberry Pi at a gate or mess counter; fetches rotating QR codes and shows confirmation flash | Device secret (separate from user JWTs) |

Roles are stored on the `users.role` column and enforced in middleware. Display devices
authenticate with a hashed per-device secret, not a user account — they have no user role.

---

## 3. Client Interfaces

All four interfaces are served from **one React application** with different routes.
There is **one backend** (Express) serving all of them.

| Interface | Audience | Key route prefix | Primary function |
|---|---|---|---|
| **Student App** | Students (mobile/web) | `/app/*` | Login, scan QR, view own history |
| **Live QR Display (Kiosk)** | Mounted display at hostel gate | `/display/gate/:deviceId` | Poll rotating QR, show confirmation flash |
| **Mess Display (Kiosk)** | Mounted display at mess counter | `/display/mess/:deviceId` | Poll rotating QR (meal-scoped), show confirmation |
| **Warden/Admin Dashboard** | Warden, Mess Admin, Super Admin | `/dashboard/*` | Live feeds, CRUD management, reports |

---

## 4. Data Model

> `students.current_state` is a **persisted column** (`INSIDE` | `OUTSIDE`) updated atomically
> inside the same transaction that writes to `hostel_attendance`. It is **not** derived by
> querying the log at read time.

### 4.1 Table Definitions

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(120) | |
| `email` | VARCHAR(255) UNIQUE | |
| `password_hash` | VARCHAR(255) | bcrypt |
| `role` | ENUM(`STUDENT`,`WARDEN`,`MESS_ADMIN`,`SUPER_ADMIN`) | |
| `is_active` | BOOLEAN | default true |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

#### `students`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | one-to-one |
| `roll_number` | VARCHAR(30) UNIQUE | |
| `hostel_id` | UUID FK → hostels | current assigned hostel |
| `room_id` | UUID FK → rooms | current assigned room |
| `photo_url` | VARCHAR(512) | used in confirmation flash |
| `current_state` | ENUM(`INSIDE`,`OUTSIDE`) | default `INSIDE`; updated in transaction |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

#### `hostels`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(120) UNIQUE | e.g. "H5 Boys Hostel" |
| `location` | VARCHAR(255) | |
| `total_capacity` | INT | |
| `warden_id` | UUID FK → users (nullable) | assigned warden |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

#### `rooms`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `hostel_id` | UUID FK → hostels | |
| `room_number` | VARCHAR(20) | unique within hostel |
| `capacity` | INT | |
| `created_at` | DATETIME | |

#### `gates`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `hostel_id` | UUID FK → hostels | |
| `name` | VARCHAR(80) | e.g. "Main Gate", "Back Gate" |
| `created_at` | DATETIME | |

#### `devices`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `device_name` | VARCHAR(120) | human label |
| `purpose` | ENUM(`GATE`,`MESS`) | determines which QR type it issues |
| `gate_id` | UUID FK → gates (nullable) | set when purpose=GATE |
| `mess_id` | UUID FK → messes (nullable) | set when purpose=MESS |
| `secret_hash` | VARCHAR(255) | bcrypt hash of per-device shared secret |
| `is_active` | BOOLEAN | revoking sets false; device next heartbeat gets 401 |
| `last_heartbeat_at` | DATETIME | updated by heartbeat endpoint |
| `registered_by` | UUID FK → users | super admin who registered it |
| `created_at` | DATETIME | |

#### `messes`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(120) UNIQUE | |
| `hostel_id` | UUID FK → hostels (nullable) | null = shared/central mess |
| `mess_admin_id` | UUID FK → users (nullable) | |
| `created_at` | DATETIME | |

#### `meal_windows`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `mess_id` | UUID FK → messes | |
| `meal_type` | ENUM(`BREAKFAST`,`LUNCH`,`SNACKS`,`DINNER`) | |
| `start_time` | TIME | e.g. 07:30 |
| `end_time` | TIME | e.g. 09:30 |
| `is_active` | BOOLEAN | admin can disable for a day |
| `created_at` | DATETIME | |

#### `qr_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `token_hash` | VARCHAR(255) UNIQUE INDEX | SHA-256 of the raw token |
| `device_id` | UUID FK → devices | binds token to issuing device |
| `purpose` | ENUM(`GATE`,`MESS`) | must match devices.purpose |
| `gate_id` | UUID FK → gates (nullable) | set when purpose=GATE |
| `mess_id` | UUID FK → messes (nullable) | set when purpose=MESS |
| `meal_window_id` | UUID FK → meal_windows (nullable) | resolved at issue time for MESS tokens |
| `status` | ENUM(`UNUSED`,`USED`,`EXPIRED`,`REVOKED`) | |
| `expires_at` | DATETIME | TTL 15-30 s from creation |
| `created_at` | DATETIME | |
| `used_at` | DATETIME (nullable) | set atomically when consumed |

#### `hostel_attendance`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK → students INDEX | |
| `hostel_id` | UUID FK → hostels | |
| `gate_id` | UUID FK → gates | |
| `device_id` | UUID FK → devices | |
| `direction` | ENUM(`ENTRY`,`EXIT`) | |
| `scanned_at` | DATETIME INDEX | |
| `qr_token_id` | UUID FK → qr_tokens | |

#### `mess_attendance`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK → students INDEX | |
| `mess_id` | UUID FK → messes | |
| `meal_window_id` | UUID FK → meal_windows | |
| `device_id` | UUID FK → devices | |
| `meal_type` | ENUM(`BREAKFAST`,`LUNCH`,`SNACKS`,`DINNER`) | |
| `date` | DATE INDEX | |
| `scanned_at` | DATETIME | |
| `qr_token_id` | UUID FK → qr_tokens | |
| — | UNIQUE(`student_id`, `meal_window_id`, `date`) | prevents duplicate scans per meal |

#### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users INDEX | |
| `token_hash` | VARCHAR(255) UNIQUE | SHA-256 of raw refresh token |
| `expires_at` | DATETIME | |
| `revoked_at` | DATETIME (nullable) | set on rotation/logout |
| `created_at` | DATETIME | |

#### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `actor_id` | UUID (nullable) | user or device performing the action |
| `actor_type` | ENUM(`USER`,`DEVICE`,`SYSTEM`) | |
| `action` | VARCHAR(120) | e.g. `USER_LOGIN`, `DEVICE_REGISTERED`, `TOKEN_REVOKED` |
| `target_type` | VARCHAR(60) (nullable) | e.g. `Student`, `Device` |
| `target_id` | UUID (nullable) | |
| `meta` | JSON (nullable) | any extra context (IP, old/new values) |
| `created_at` | DATETIME INDEX | |

---

## 5. QR Token Design

- **Opaque random token**: 32-byte cryptographically random value, base64url-encoded.
  The raw token is returned to the display device once; only its **SHA-256 hash** is stored
  server-side. If the database is compromised, stored hashes cannot be replayed.
- **No identity or trust embedded client-side**: the token carries no student ID, gate ID,
  or direction. All validation is server-side using the device's registered metadata.
- **TTL**: 15-30 seconds (configurable per environment). Set in `expires_at` at issue time.
- **States**:
  - `UNUSED` — issued, not yet scanned
  - `USED` — consumed in a single atomic transaction (status + `used_at` set together)
  - `EXPIRED` — background sweeper marks tokens where `expires_at < NOW()` and `status = UNUSED`
  - `REVOKED` — admin/device disable triggers bulk revoke of all `UNUSED` tokens for that device
- **One-time use enforced by DB**: `status` is set to `USED` inside the transaction that
  writes the attendance row; concurrent scans of the same token will fail on the unique
  `token_hash` constraint or find status != UNUSED.

---

## 6. Anti-Proxy Design (MVP, Non-Negotiable)

The system layers multiple controls to prevent a student from forwarding a QR image to a
friend who scans it remotely.

| Layer | Mechanism |
|---|---|
| **One-time use** | Token consumed on first valid scan; replayed tokens are rejected |
| **Short TTL** | 15-30 s window; a forwarded screenshot expires before the recipient can act |
| **Purpose binding** | `qr_tokens.purpose` must match the device's registered purpose; a MESS token cannot be used at a gate |
| **Device binding** | `qr_tokens.device_id` must match the device that issued it; tokens are non-transferable across devices |
| **Post-scan confirmation flash (MVP)** | After a successful scan the gate/mess display shows the student's **name and photo** for ~5 seconds. On-site staff can visually confirm the person in front of the display matches. This is enforced at the protocol level — the `display:confirm` Socket.IO event always carries the student snapshot, and the kiosk UI always renders it. It cannot be skipped. |

---

## 7. Device Authentication

- Each device entry in the `devices` table has a `secret_hash` (bcrypt of a 32-byte random
  secret issued at registration time).
- The plaintext secret is shown **once** at registration (like an API key); it is never
  stored or retrievable again.
- Devices send `Authorization: Bearer <device_secret>` on every request. The backend
  verifies against `secret_hash`.
- **Heartbeat endpoint** (`POST /api/devices/heartbeat`): devices call this every 30-60 s.
  Updates `last_heartbeat_at`. Dashboards can alert if a device goes silent.
- **Instant revoke**: setting `devices.is_active = false` causes the next device request
  (including the heartbeat) to receive HTTP 401. Any `UNUSED` QR tokens issued by that
  device are bulk-revoked to `REVOKED` status.
- Device registration is a Super Admin action only; it creates the `devices` row and returns
  the plaintext secret once.

---

## 8. Real-Time Event Model (Socket.IO)

### Room Naming

| Scope | Room name |
|---|---|
| Per hostel | `hostel:<hostelId>` |
| Per mess | `mess:<messId>` |
| Admin global | `admin:global` |

### Event Types

| Event | Emitted to room | Payload |
|---|---|---|
| `attendance:new` | `hostel:<hostelId>` | `{ studentId, name, photoUrl, direction, gate, scannedAt, currentOccupancy }` |
| `mess:attendance:new` | `mess:<messId>` | `{ studentId, name, photoUrl, mealType, messId, scannedAt, dailyCount }` |
| `display:confirm` | `device:<deviceId>` | `{ studentName, photoUrl, direction or mealType, timestamp }` shown as confirmation flash |
| `device:heartbeat` | `admin:global` | `{ deviceId, deviceName, timestamp }` |
| `device:alert` | `admin:global` | `{ deviceId, deviceName, reason: 'OFFLINE' or 'REVOKED' }` |

Clients (React kiosks, dashboards) connect to the relevant rooms after authenticating.
Kiosk devices join `device:<deviceId>` to receive their confirmation flash.

---

## 9. REST API Surface

All routes are prefixed `/api`. Auth middleware reads `Authorization: Bearer <jwt>` for user
routes; device routes use the device secret.

### Auth

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | User login — access token + refresh token |
| POST | `/api/auth/refresh` | Public | Rotate refresh token — new access + refresh |
| POST | `/api/auth/logout` | Authenticated | Revoke current refresh token |

### Devices

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/devices/register` | SUPER_ADMIN | Register new device, get one-time secret |
| GET | `/api/devices` | SUPER_ADMIN | List all devices |
| PATCH | `/api/devices/:id/disable` | SUPER_ADMIN | Disable device + revoke its tokens |
| POST | `/api/devices/heartbeat` | Device auth | Update last_heartbeat_at |

### Display / QR

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/display/qr` | Device auth | Issue a fresh QR token; device polls this every ~15 s |

### Attendance — Scan

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/attendance/scan` | STUDENT | Validate token, record attendance (hostel or mess), emit Socket.IO events. Rate-limited: 5 req/min per student. |

### Hostel Attendance

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/attendance/hostel` | WARDEN, SUPER_ADMIN | List hostel attendance (filterable by hostel, date, direction) |
| GET | `/api/attendance/hostel/occupancy` | WARDEN, SUPER_ADMIN | Current occupancy per hostel |

### Mess Attendance

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/attendance/mess` | MESS_ADMIN, SUPER_ADMIN | List mess attendance (filterable by mess, date, meal_type) |
| GET | `/api/attendance/mess/counts` | MESS_ADMIN, SUPER_ADMIN | Daily meal counts per mess |

### Students

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/students` | WARDEN, SUPER_ADMIN | List students |
| POST | `/api/students` | SUPER_ADMIN | Create student + linked user |
| GET | `/api/students/:id` | WARDEN, SUPER_ADMIN | Get student detail |
| PATCH | `/api/students/:id` | SUPER_ADMIN | Update student (room, hostel) |
| DELETE | `/api/students/:id` | SUPER_ADMIN | Soft-delete |

### Hostels, Rooms, Gates

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET/POST | `/api/hostels` | SUPER_ADMIN | List / create hostels |
| GET/PATCH/DELETE | `/api/hostels/:id` | SUPER_ADMIN | Hostel detail / update / delete |
| GET/POST | `/api/hostels/:id/rooms` | SUPER_ADMIN | List/create rooms in a hostel |
| GET/POST | `/api/hostels/:id/gates` | SUPER_ADMIN | List/create gates in a hostel |

### Messes and Meal Windows

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET/POST | `/api/messes` | SUPER_ADMIN | List / create messes |
| GET/PATCH/DELETE | `/api/messes/:id` | SUPER_ADMIN | Mess detail / update / delete |
| GET/POST | `/api/messes/:id/meal-windows` | SUPER_ADMIN, MESS_ADMIN | List / create meal windows |
| PATCH | `/api/messes/:id/meal-windows/:wid` | SUPER_ADMIN, MESS_ADMIN | Update meal window (toggle active) |

### Analytics

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/analytics/occupancy-history` | WARDEN, SUPER_ADMIN | Occupancy over time (filterable) |
| GET | `/api/analytics/meal-trends` | MESS_ADMIN, SUPER_ADMIN | Meal count trends by type/date |
| GET | `/api/analytics/export` | SUPER_ADMIN | CSV/JSON export of attendance |

### Student Self-Service

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| GET | `/api/me` | STUDENT | Own profile + current_state |
| GET | `/api/me/hostel-history` | STUDENT | Own entry/exit log |
| GET | `/api/me/mess-history` | STUDENT | Own meal history |

---

## 10. Security Model

### JWT Access Tokens
- Short-lived: **15 minutes** TTL.
- Signed with `ACCESS_TOKEN_SECRET` (HS256).
- Payload: `{ sub: userId, role, iat, exp }`.
- Never stored server-side; validated by signature + exp check.

### Refresh Tokens
- Long-lived: **7 days** TTL.
- Cryptographically random 32-byte value, stored as SHA-256 hash in `refresh_tokens`.
- Rotating: each `/api/auth/refresh` call issues a new pair and revokes the old token.
- Single-use detection: if a refresh token is presented after it has been revoked, **all**
  refresh tokens for that user are immediately revoked (token reuse = breach indicator).

### RBAC Middleware
- Every protected route declares the minimum required role.
- Middleware chain: `authenticate` (verifies JWT) -> `authorize(role[])` (checks user.role).
- Device routes use `authenticateDevice` middleware instead.

### Rate Limiting
- `/api/attendance/scan`: **5 requests per minute per student** (keyed on JWT sub).
- `/api/auth/login`: **10 requests per minute per IP**.
- Applied via `express-rate-limit` at the route level.

### Audit Logging
- Written on: login, logout, device register/disable, student create/update/delete,
  token revoke, any SUPER_ADMIN action, and every scan attempt (success and failure).
- Written inside the same transaction where applicable.

---

## 11. Non-Functional Targets and Indexes

| Concern | Approach |
|---|---|
| **Consistency** | All attendance writes (hostel or mess) use Prisma transactions: QR token status update + attendance row insert + student.current_state update are atomic. |
| **Duplicate scan prevention** | `UNIQUE(student_id, meal_window_id, date)` on `mess_attendance`. DB-level constraint is the last line of defence; app layer checks first. |
| **Hot-path indexes** | `hostel_attendance(student_id, scanned_at)`, `hostel_attendance(hostel_id, scanned_at)`, `mess_attendance(mess_id, date, meal_type)`, `qr_tokens(token_hash)`, `qr_tokens(expires_at, status)` for sweeper, `refresh_tokens(token_hash)`, `audit_logs(created_at)`. |
| **Token expiry sweep** | Background job (node-cron every 60 s): UPDATE qr_tokens SET status='EXPIRED' WHERE status='UNUSED' AND expires_at < NOW(). |
| **Scalability baseline** | Single-node for MVP. Socket.IO rooms scoped tightly so broadcast fan-out is minimal. |
| **Environment parity** | `.env` drives all secrets and feature flags; `.env.example` committed; `.env` git-ignored. |
