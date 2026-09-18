# HOSTEL360 — Progress Log

> **READ THIS FIRST at the start of every session.**
> Do NOT re-read ARCHITECTURE.md or FEATURES.md in full unless this file is missing or
> explicitly says the architecture changed. Trust this file as the current state.
> Open only the files listed in "Files Touched This Session" and whatever the next step requires.

---

## Current Phase

**Phase 2 — Authentication**

---

## Last Completed Step

**1.9 React shell** — `App.tsx` sets up `react-router-dom` with placeholder routes for all client interfaces (`/app/*`, `/display/gate/:deviceId`, `/display/mess/:deviceId`, `/dashboard/*`) with navigation and responsive dark UI. (Phase 1 Complete)

---

## Next Step

**2.1 User login endpoint** — `POST /api/auth/login` accepts `{ email, password }`, verifies bcrypt hash, returns `{ accessToken, refreshToken, user }`. Returns 401 on bad credentials.

Reference: `FEATURES.md` checkbox 2.1

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
