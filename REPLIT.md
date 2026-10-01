# SmartLab 2.0 — Laboratory Management System
**PUP Lopez Campus · Replit Agent Onboarding Guide**

---

## What this project is

SmartLab 2.0 is a full-stack web application that manages laboratory resources at PUP Lopez Campus. It handles:

- **Equipment inventory** — CRUD, availability tracking, borrowing/return lifecycle
- **Borrow requests** — Students/faculty submit requests; admins approve, borrow, return, or cancel
- **Lab schedules** — ONE_TIME and WEEKLY schedule creation with conflict detection
- **Academic directory** — Buildings, rooms, programs, subjects, departments, academic years, terms
- **User management** — Role-based access for ADMIN, FACULTY, and STUDENT
- **Notifications** — In-app notifications triggered by request status changes
- **Conflict detection** — Prevents double-booking of rooms and over-borrowing of equipment

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript, Prisma 5, PostgreSQL |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Auth | JWT (stored as `token` in localStorage) |
| Email | Nodemailer (Gmail SMTP) |
| Testing | Jest 29, plain `node:http` test helpers (no supertest) |

---

## First-Time Setup (new Replit account)

Run these steps in order after importing the repo.

### 1. Provision the PostgreSQL database

Open the **Database** panel in Replit (left sidebar → Database icon) and create a new PostgreSQL database. Replit injects `DATABASE_URL` automatically.

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Create or update the database schema

```bash
cd backend && npx prisma db push
```

The development setup uses `schema.prisma` as the source of truth and
`prisma db push` to create or synchronize the PostgreSQL schema.

### 4. Seed the database

```bash
cd backend && NODE_ENV=development ALLOW_DEMO_SEED=1 DEMO_DATABASE_NAME=YOUR_DISPOSABLE_DATABASE npm run db:seed
```

This creates:
- Admin user: `admin@smartlab.local` / `SmartLab123!`
- Faculty user: `jane.delacruz@smartlab.local` / `SmartLab123!`
- Student user: `paolo.santos@smartlab.local` / `SmartLab123!`
- Sample academic years, terms, equipment, programs, subjects, departments

### 5. Start both workflows

In the Replit workflow panel, start:
- **Backend API** — runs `cd backend && npm run dev` on port **3001**
- **Start application** — runs `cd frontend && npm run dev` on port **5000**

Or start them both at once via the **Project** run button.

### 6. PDF report exports

The admin borrow-request report's **Export to PDF** actions use the backend's
server-side Chromium renderer. The Replit runtime provides Chromium at
`/repl/tools/bin/chromium`; deployments should preserve that runtime or set
`CHROMIUM_PATH` to an available Chromium executable. The generated document
uses the institutional 13 × 8.5 inch landscape form and is downloaded directly
without opening the browser print dialog.

---

## Environment Variables

Replit injects `DATABASE_URL` automatically from the Database integration.

Configure DATABASE_URL and a unique JWT_SECRET in environment secrets. Optional SMTP settings belong there too. Never commit credentials. See [local development](docs/local-development.md) for portable setup and guarded seeding.

---

## Running the Test Suite

All tests live in `backend/tests/` and hit the live backend on port 3001. The backend must be running before executing tests.

```bash
# Full suite (141 tests, 8 files)
cd backend && npm test

# Individual suites
npm run test:auth
npm run test:equipment
npm run test:users
npm run test:borrow
npm run test:schedules
npm run test:directory
npm run test:notifications
npm run test:conflicts
```

**Expected result:** 141 tests pass, 8/8 suites green, ~8 seconds.

### Reusable realistic user journey

`backend/tests/realistic-user-journey.test.js` runs one normal operating
scenario through the API using admin, faculty, and student personas. It uses
realistic names and reasons and covers:

- authentication, profiles, role restrictions, and user management
- academic directory and equipment CRUD
- student borrow requests, edits, duplicate protection, approval, borrowing,
  return, rejection, and cancellation
- faculty lab-schedule requests and admin approvals
- one-time and weekly schedules, updates, conflict checks, and deletion
- equipment availability/conflicts, automatic adjustments, and notifications

Run it against the backend after seeding:

```bash
cd backend
npm run test:realistic
```

To recreate a clean database and restore the normal seed data first, use the
explicitly guarded reset command:

```bash
cd backend
npm run db:push
NODE_ENV=test ALLOW_DEMO_SEED=1 DEMO_DATABASE_NAME=YOUR_DISPOSABLE_DATABASE RESET_TEST_DATABASE=1 npm run db:reset:test
npm run test:realistic
```

The reset command deletes all data in the configured database, so it refuses
to run unless reset confirmation, demo seed confirmation, a matching database name, and development/test mode are all set.

### Test files

| File | What it covers |
|------|---------------|
| `auth.test.js` | Login, register, JWT validation, `/auth/me` |
| `equipment.test.js` | CRUD, stats, status derivation, role guards |
| `users.test.js` | CRUD, role filters, activate/deactivate |
| `borrowRequests.test.js` | Full lifecycle, duplicate detection (409), cancel rules |
| `labSchedules.test.js` | Create, conflict (409), CRUD, role guards |
| `academicDirectory.test.js` | Buildings, rooms, programs, subjects, departments |
| `notifications.test.js` | List, unread count, mark-read |
| `conflicts.test.js` | `/conflicts/check` endpoint |

### Test reliability notes

- `academicDirectory.test.js` uses `Math.random()` for program/subject codes to avoid uniqueness conflicts across runs.
- `labSchedules.test.js` deletes all schedules for the test room in `beforeAll` to prevent WEEKLY schedule conflicts from accumulating.
- `borrowRequests.test.js` auto-increments `dateNeeded` (starting at day+200) so each `makeRequestBody()` call uses a fresh date and never triggers the duplicate-detection guard unintentionally.

---

## Project Structure

```
/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # All models
│   │   ├── migrations/            # Migration history
│   │   └── seed.ts                # Seed data
│   ├── src/
│   │   ├── server.ts              # Express app entry point
│   │   ├── middleware/
│   │   │   └── auth.ts            # authenticateToken, authorizeRoles
│   │   └── routes/
│   │       ├── auth.ts
│   │       ├── users.ts
│   │       ├── equipment.ts
│   │       ├── equipmentAdjustments.ts
│   │       ├── equipmentConflicts.ts
│   │       ├── borrowRequests.ts  # Duplicate detection added here
│   │       ├── labSchedules.ts
│   │       ├── academicDirectory.ts
│   │       ├── conflicts.ts
│   │       └── notifications.ts
│   └── tests/
│       ├── helpers.js             # apiRequest(), loginAs(), getAdminToken(), etc.
│       ├── auth.test.js
│       ├── equipment.test.js
│       ├── users.test.js
│       ├── borrowRequests.test.js
│       ├── labSchedules.test.js
│       ├── academicDirectory.test.js
│       ├── notifications.test.js
│       └── conflicts.test.js
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── store/                 # Zustand state
    │   └── services/              # API call functions
    └── vite.config.ts             # Proxy: /api → localhost:3001
```

---

## Database Models

```
AcademicYear   Term           Building       Room
Program        Subject        Department     User
AdminProfile   FacultyProfile StudentProfile Equipment
LabSchedule    BorrowRequest  BorrowRequestItem
Notification   AuditLog
```

Key relationships:
- `User` has one of `AdminProfile | FacultyProfile | StudentProfile`
- `BorrowRequest` → many `BorrowRequestItem` → `Equipment`
- `LabSchedule` can be linked to a `BorrowRequest` (auto-created on approval for computer lab rooms)
- `Notification` is per-user, triggered by request state changes

---

## API Base URL

All API routes are prefixed with `/api`. The Vite dev server proxies `/api/*` to `http://localhost:3001`.

| Route prefix | Description |
|---|---|
| `/api/auth` | Login, register, me |
| `/api/users` | User CRUD (admin) |
| `/api/equipment` | Equipment CRUD + stats |
| `/api/borrow-requests` | Request lifecycle |
| `/api/lab-schedules` | Schedule CRUD + resources |
| `/api/academic-directory` | Buildings, rooms, programs, subjects, departments |
| `/api/conflicts` | Conflict check endpoint |
| `/api/notifications` | Notifications per user |

---

## Auth Token

JWT is stored in `localStorage` under the key **`token`**. Raw `fetch()` calls must read and attach it manually:

```js
const token = localStorage.getItem('token');
fetch('/api/...', { headers: { Authorization: `Bearer ${token}` } });
```

---

## Borrow Request Status Flow

```
PENDING → APPROVED → BORROWED → RETURNED
        ↓          ↓          ↓
      REJECTED   CANCELLED  CANCELLED (admin only)
```

- Students may only cancel their own PENDING requests.
- Admins may cancel PENDING or BORROWED requests.
- Approving a request for a computer-lab room auto-creates a `LabSchedule`.
- Duplicate detection: a second PENDING request from the same user for the same equipment on the same calendar date returns **409**.

---

## User Preferences

- Keep test files in `backend/tests/` — do not move them.
- Use Jest 29 (`node --experimental-vm-modules`) — do not upgrade to Jest 30+.
- All test helpers stay in `backend/tests/helpers.js`.
- Never hardcode secrets. Use Replit Secrets for `SMTP_PASS` and any production JWT secret.
- Maintain the existing Express + Prisma pattern in routes — no ORM changes.
