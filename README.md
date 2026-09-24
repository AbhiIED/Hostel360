# HOSTEL360 — Smart QR-Based Hostel & Mess Management System

HOSTEL360 is a full-stack, real-time management system for college hostels and messes. Fixed displays at hostel gates and mess counters show dynamic, short-lived QR codes. Authenticated students scan them using their mobile/web app, and the backend verifies authenticity, updates attendance state atomically, broadcasts updates via Socket.IO, and flashes the student's photo on the kiosk display to eliminate proxy scanning.

---

## Tech Stack
- **Frontend**: React.js, Tailwind CSS, Socket.IO Client, Lucide Icons, Vite
- **Backend**: Node.js, Express, Prisma ORM, MySQL 8+, Socket.IO, JWT (access + refresh), bcrypt
- **Architecture & Design**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Roadmap & Checklist**: See [docs/FEATURES.md](docs/FEATURES.md)
- **Work Progress Log**: See [docs/PROGRESS.md](docs/PROGRESS.md)

---

## Directory Structure
```
Hostel360/
├── backend/            # Express REST API, Prisma ORM, Socket.IO server
│   ├── prisma/         # Prisma schema and seed scripts
│   └── src/            # Backend routes, controllers, middleware, services
├── frontend/           # Vite + React single page app
│   └── src/            # Components, pages, hooks, contexts
├── docs/               # System architecture, features checklist, progress log
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL Server 8+ running locally or accessible via network
- npm or yarn

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
# Update .env with your MySQL credentials and secrets
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` to view the application.
