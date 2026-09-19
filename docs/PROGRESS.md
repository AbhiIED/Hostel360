# HOSTEL360 — Progress Log

> **READ THIS FIRST at the start of every session.**
> Do NOT re-read ARCHITECTURE.md or FEATURES.md in full unless this file is missing or
> explicitly says the architecture changed. Trust this file as the current state.
> Open only the files listed in "Files Touched This Session" and whatever the next step requires.

---

## Current Phase

**Phase 3 — Device Authentication**

---

## Last Completed Step

**Phase 2 Complete (2.1 - 2.9)** — User login, JWT access (15m) + rotating refresh (7d), single-use reuse breach detection, RBAC middleware, IP rate limiting, audit logging on auth events, and React frontend login flow with auto-refresh Axios interceptor.

---

## Next Step

**3.1 Device registration endpoint** — `POST /api/devices/register` (SUPER_ADMIN); creates `devices` row, generates 32-byte random secret, returns plaintext secret once; stores bcrypt hash in `secret_hash`.

Reference: `FEATURES.md` checkbox 3.1

---

## Key Decisions Log

- **2026-09-18** — Architecture established. All decisions match ARCHITECTURE.md as written.
  No deviations yet.
- **Stack confirmed**: React + Tailwind CSS (frontend), Node.js + Express (backend),
  Prisma ORM, MySQL 8+, Socket.IO, JWT (access 15 min + refresh 7 days), bcrypt.
- **Anti-proxy confirmation flash is MVP and non-negotiable** — cannot be removed or
  deferred without explicit user approval.
- **`students.current_state` is a persisted column**, not derived from log — updated
  atomically in the same transaction as each hostel attendance write.
- **QR tokens are opaque** — only SHA-256 hash stored server-side; no identity embedded.
- **Device auth is separate from user auth** — devices use a per-device bcrypt-hashed
  secret, not JWTs.
- **2026-09-19** — MANIT Specific Hostel Configuration: Added `HostelType` enum (`BOYS`, `GIRLS`) to `Hostel` model. Configured MANIT Hostels 1 through 12, where Hostels 7 and 12 are designated as Girls Hostels and Hostels 1–6 and 8–11 are Boys Hostels. Seed script and MySQL database updated and migrated.

---

## Known Issues / TODO

- None yet (no code written).

---

## Files Touched This Session

- `docs/ARCHITECTURE.md` — Created (Step 0a complete)
- `docs/FEATURES.md` — Updated (Checkboxes 1.1 - 1.7 ticked)
- `docs/PROGRESS.md` — Updated
- `.gitignore` — Created
- `README.md` — Created
- `backend/` — Created
- `backend/package.json` — Created & dependencies installed
- `backend/.env.example` — Created
- `backend/.env` — Created & configured
- `backend/prisma/schema.prisma` — Created & validated
- `backend/prisma/migrations/` — Generated and applied
- `backend/prisma/seed.js` — Created & seeded
- `backend/src/index.js` — Created & running
- `frontend/` — Created
