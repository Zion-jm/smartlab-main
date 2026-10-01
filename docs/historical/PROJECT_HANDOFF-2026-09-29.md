# Historical handoff — superseded

Snapshot predating remediation steps 1–20. Commands, counts, security assumptions, and proposed work below are historical and must not be used as current setup instructions. See ../../PROJECT_HANDOFF.md and ../reproducible-verification.md.

# SmartLab 2.0 — Project Handoff

This document is the working handoff for the SmartLab 2.0 laboratory management
system. It describes the current repository structure, technology choices,
runtime behavior, data model, API surface, user roles, development workflow,
and known operational considerations.

It is based on the repository state inspected on **29 September 2026**. File
contents and package manifests are the source of truth if this document and the
code differ.

---

## 1. Project Summary

SmartLab 2.0 is a full-stack web application for managing laboratory resources
at PUP Lopez Campus. It supports:

- Equipment inventory and quantity tracking
- Equipment borrowing and return workflows
- Borrow requests from students and faculty
- Admin review and approval of requests
- One-time and weekly laboratory schedules
- Room and equipment conflict detection
- Academic years, terms, buildings, rooms, programs, subjects, and departments
- Role-based portals for administrators, faculty, and students
- In-app notifications and optional email notifications
- Audit logging for administrative activity
- Administrative reports exported as PDF
- Profile and password management

The application is organized as a small monorepo with separate frontend and
backend packages. It is not a single compiled frontend/backend bundle during
development: Vite serves the frontend on port 5000 and Express serves the API
on port 3001.

---

## 2. Project Size

The following counts describe the imported repository at the time this
document was written. Generated dependencies and build output are excluded
where applicable.

| Area | Approximate size |
| --- | ---: |
| Git-tracked files | 501 |
| Frontend files | 101 |
| Backend files | 45 |
| Frontend/backend TypeScript, TSX, and JavaScript source files | 110 |
| Frontend/backend source lines | 35,859 |
| Prisma schema | 462 lines |
| Backend test files | 10 |
| Documentation files in `docs/` | 9 |
| Screenshots | 26 |
| Attached image/PDF/text assets | 295 |
| Prisma database models | 17 |
| Prisma enums | 6 |
| Backend route modules | 13 |

The project is medium-sized rather than a small starter application. The
frontend contains multiple complete portal pages and a substantial shared
component layer. The backend contains business rules for workflow state
transitions, schedule conflicts, inventory quantities, notifications, audit
logs, and report generation.

---

## 3. Technology Stack

### Frontend

- **Language:** TypeScript
- **Framework:** React 19
- **Build tool and dev server:** Vite 8
- **Routing:** React Router 7
- **State management:** Zustand 5 with persistence for authentication state
- **HTTP client:** Axios
- **Styling:** Tailwind CSS 4 through PostCSS, plus project CSS and design
  tokens
- **Icons:** `lucide-react`
- **Date and calendar utilities:** `date-fns`, `react-datepicker`,
  `react-day-picker`
- **Linting:** ESLint 9 with TypeScript, React Hooks, and React Refresh rules
- **Compiler:** TypeScript 5.9

### Backend

- **Runtime:** Node.js 20
- **Language:** TypeScript
- **HTTP framework:** Express 4
- **ORM:** Prisma 5
- **Database:** PostgreSQL
- **Authentication:** JWT using `jsonwebtoken`
- **Password hashing:** `bcryptjs`
- **Security middleware:** `helmet`
- **Cross-origin handling:** `cors`
- **Environment loading:** `dotenv`
- **Email:** Nodemailer with SMTP
- **PDF generation:** Server-side Chromium through the report PDF service
- **Development reload:** Nodemon
- **Testing:** Jest 29 with Node-based HTTP test helpers

### Workspace and platform configuration

- Root npm workspaces: `backend` and `frontend`
- Root orchestration: `concurrently`
- Replit modules: Node.js 20, web, and Python 3.12
- Replit development channel: stable NixOS channel
- Python is present for repository utilities, including the borrower-log
  rendering helper, but the main application is Node/TypeScript.

---

## 4. Repository Structure

```text
.
├── .agents/
│   ├── memory/                 Durable project notes used by future agents
│   └── scripts/                Repository helper scripts
├── attached_assets/            Imported images, PDF, and text assets
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       PostgreSQL schema and relations
│   │   └── seed.ts             Development/reference data seeding
│   ├── scripts/
│   │   ├── checkUser.ts        User inspection helper
│   │   └── reset-test-database.ts
│   ├── src/
│   │   ├── middleware/         Authentication and role authorization
│   │   ├── routes/             Express route modules
│   │   ├── services/           Domain services, email, PDF reports
│   │   ├── types/              Backend TypeScript types
│   │   ├── utils/              Backend utility functions
│   │   └── server.ts           Express application entry point
│   ├── tests/                  Jest API and workflow tests
│   ├── API.md                  Existing API reference; verify against source
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── CHANGELOG.md
│   ├── component-guide.md
│   ├── development-guide.md
│   ├── project-test-plan.md
│   ├── reusable-table-standardization-plan.md
│   └── control-ribbon*.md      Control ribbon rollout and consistency notes
├── frontend/
│   ├── src/
│   │   ├── components/         Shared layouts and feature components
│   │   ├── constants/          Role and year-level constants
│   │   ├── hooks/              Reusable React hooks
│   │   ├── pages/              Route-level screens
│   │   ├── services/           Axios API client
│   │   ├── stores/             Zustand stores
│   │   ├── styles/             Design tokens
│   │   ├── types/              Frontend data types
│   │   ├── utils/              Date, status, and time-block utilities
│   │   ├── index.css           Global styles
│   │   └── main.tsx            React Router entry point
│   ├── public/                 Public static files, if present
│   ├── index.html
│   ├── vite.config.ts
│   ├── postcss.config.js
│   ├── package.json
│   └── tsconfig*.json
├── screenshots/                UI/reference screenshots
├── .env                        Local environment template/configuration
├── .replit                     Replit workflows, ports, and deployment config
├── REPLIT.md                   Replit onboarding and operating notes
├── package.json                Root workspace scripts
├── package-lock.json
├── pnpm-lock.yaml
└── PROJECT_HANDOFF.md          This document
```

`node_modules/`, build directories, and other generated files are intentionally
not part of the structural description above.

---

## 5. Frontend Architecture

### Entry point and routing

`frontend/src/main.tsx` creates the React root, installs `BrowserRouter`, adds
the global toaster, and defines all application routes. Protected routes are
wrapped with `ProtectedRoute`, which checks authentication and role membership.

Current routes:

| Route | Access | Page |
| --- | --- | --- |
| `/` | Public | Branded landing page and sign-in experience |
| `/login` | Public redirect | Redirects to `/` for old bookmarks |
| `/admin/dashboard` | ADMIN | Admin dashboard |
| `/admin/users` | ADMIN | Account management |
| `/admin/schedule` | ADMIN | Laboratory schedule management |
| `/admin/requests` | ADMIN | Borrow request review |
| `/admin/academic-directory` | ADMIN | Buildings, rooms, programs, subjects, departments |
| `/admin/equipment` | ADMIN | Equipment inventory and availability |
| `/admin/reports` | ADMIN | Report views and PDF export |
| `/admin/academic-period` | ADMIN | Academic year and term activation |
| `/admin/audit-logs` | ADMIN | Audit log viewer |
| `/faculty/panel` | FACULTY | Faculty portal |
| `/student/panel` | STUDENT | Student portal |
| `/profile` | Any authenticated role | Profile and role information |
| `/settings` | Any authenticated role | Account settings and password management |

Users who are authenticated with the wrong role are redirected to their own
role home rather than being shown another portal.

### Page-level features

#### Public and shared pages

- `LandingPage.tsx` contains the branded sign-in experience and public
  navigation sections.
- `ProfilePage.tsx` contains shared profile details, role information, and
  password change behavior.
- `ProfileRoute.tsx` selects the appropriate portal shell for the current user.
- `SettingsRoute.tsx` provides shared settings access.

#### Admin pages

- `AdminDashboard.tsx` — overview cards and administrative summaries
- `ManageAccounts.tsx` — user search, role/status filtering, account creation,
  editing, and status operations
- `AdminLabSchedule.tsx` — schedule list, filters, calendar/chart/table views,
  creation, updates, and conflict-aware operations
- `AdminRequests.tsx` — request filtering, pagination, detail view, and status
  actions
- `AdminAcademicDirectory.tsx` — academic directory management
- `AdminEquipment.tsx` — inventory, stock, status, and conflict-aware equipment
  operations
- `AdminReports.tsx` — borrow request, demand, schedule, and equipment reports
- `AdminAcademicPeriod.tsx` — current academic year and term selection
- `AdminAuditLogs.tsx` — searchable and paginated audit history

#### Faculty and student portals

- `FacultyPanel.tsx` — faculty schedule views, request operations, equipment
  access, notifications, and portal navigation
- `StudentPanel.tsx` — new borrow request, own requests, schedule views,
  equipment selection, room/equipment conflict checks, and notifications

### Component organization

The component layer is organized by domain:

- `components/admin/` — admin dashboards, report documents, request drawers,
  and printable report views
- `components/accounts/` — account drawers and account creation
- `components/academic-directory/` — academic directory drawer
- `components/equipment/` — equipment cards, drawers, availability, calendar,
  reservation, and conflict components
- `components/lab-schedule/` — schedule modal
- `components/shared/` — buttons, cards, tables, pagination, filtering,
  dropdowns, date pickers, confirmation dialogs, empty states, toasts,
  ribbons, conflict displays, and reusable page controls
- `AdminLayout.tsx` and `PortalLayout.tsx` — portal shells and navigation
- `ProtectedRoute.tsx` — frontend authentication and role guard
- `NotificationBell.tsx` — shared notification access

### State and API access

Zustand stores currently cover:

- `authStore.ts` — current user, token, login/logout, persisted auth state
- `notificationStore.ts` — notification and unread-count state
- `preferencesStore.ts` — UI preferences
- `toastStore.ts` — application toast messages

`frontend/src/services/api.ts` is the main Axios client. It:

1. Uses `VITE_API_BASE_URL` when provided.
2. Falls back to `/api`.
3. Reads the JWT from `localStorage` key `token`.
4. Adds `Authorization: Bearer <token>` to outgoing requests.
5. Exposes grouped clients for auth, equipment, borrow requests, users,
   academic directory, schedules, academic periods, audit logs, conflicts,
   notifications, and PDF reports.

The development Vite server proxies `/api` to
`http://localhost:3001`.

---

## 6. Backend Architecture

`backend/src/server.ts` is the Express entry point. It:

1. Loads environment variables with `dotenv`.
2. Creates a Prisma client.
3. Installs `helmet`, CORS, and JSON parsing.
4. Exposes health and database test endpoints.
5. Mounts the route modules under `/api`.
6. Provides general error and 404 handlers.
7. Starts email transport verification.
8. Disconnects Prisma on SIGTERM and SIGINT.

### Middleware

`backend/src/middleware/auth.ts` provides:

- `authenticateToken` — validates a Bearer JWT, loads the user from PostgreSQL,
  and attaches a compact user object to the Express request.
- `authorizeRoles(...roles)` — restricts an endpoint to one or more enum roles.
- `generateToken` — creates a 24-hour JWT containing user ID, email, and role.

Passwords are hashed with bcrypt before storage.

### Services

- `academicPeriodService.ts` — current academic year/term resolution
- `auditLogService.ts` — administrative action logging
- `borrowRequestService.ts` — request-related business logic
- `labScheduleService.ts` — schedule logic and conflict-aware operations
- `notificationService.ts` — in-app notifications and notification triggers
- `email/` — SMTP transporter and email templates
- `reportPdfService.ts` — server-side PDF generation using Chromium

### API route map

The API base path is `/api`. Except where noted, protected endpoints expect a
JWT Bearer token.

#### Authentication — `/api/auth`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/register` | Register a user |
| POST | `/login` | Authenticate and issue a JWT |
| GET | `/me` | Return the current authenticated user |
| PATCH | `/password` | Change the authenticated user's password |

#### Equipment — `/api/equipment`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | List equipment with filters |
| GET | `/:id` | Read equipment details |
| POST | `/` | Create equipment; admin |
| PUT | `/:id` | Update equipment; admin |
| DELETE | `/:id` | Delete equipment; admin |
| GET | `/stats/overview` | Admin equipment statistics |

#### Users — `/api/users`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | List/search users |
| POST | `/` | Create a managed user |
| GET | `/:id` | Read a user, subject to access rules |
| PUT | `/:id` | Update a user |
| PATCH | `/:id/status` | Activate/deactivate a user |
| DELETE | `/:id` | Delete a user |

#### Borrow requests — `/api/borrow-requests`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Admin request listing |
| GET | `/my-requests` | Current user's requests |
| GET | `/:id` | Request detail |
| POST | `/` | Create a request |
| PUT | `/:id` | Update a request |
| PATCH | `/:id/approve` | Approve a pending request |
| PATCH | `/:id/reject` | Reject a pending request |
| PATCH | `/:id/borrow` | Mark approved equipment as borrowed |
| PATCH | `/:id/return` | Mark borrowed equipment as returned |
| PATCH | `/:id/cancel` | Cancel a request |

Normal status flow:

```text
PENDING -> APPROVED -> BORROWED -> RETURNED
    |          |            |
    +--------> REJECTED     |
    +--------> CANCELLED ---+
```

The route and service logic also updates equipment quantities, notifications,
audit records, and related schedules where appropriate.

#### Laboratory schedules — `/api/lab-schedules`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | List/filter schedules |
| GET | `/resources` | Load faculty, rooms, programs, subjects, and related resources |
| GET | `/:id` | Read one schedule |
| POST | `/admin/create` | Admin creates a schedule directly |
| POST | `/request` | Faculty requests a schedule |
| GET | `/check-conflicts/:requestId` | Check schedule request conflicts |
| PATCH | `/approve-request/:requestId` | Approve a faculty schedule request |
| PUT | `/:id` | Update a schedule |
| DELETE | `/:id` | Delete a schedule |

Schedules support `ONE_TIME` and `WEEKLY` types and are associated with
academic period, room, faculty, program, subject, and time data.

#### Academic directory — `/api/academic-directory`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Directory overview |
| GET | `/programs` | Program list |
| GET | `/departments` | Department list |
| POST/PUT | `/buildings`, `/buildings/:id` | Create/update buildings |
| POST/PUT | `/rooms`, `/rooms/:id` | Create/update rooms |
| POST/PUT | `/programs`, `/programs/:id` | Create/update programs |
| POST/PUT | `/subjects`, `/subjects/:id` | Create/update subjects |
| POST/PUT | `/departments`, `/departments/:id` | Create/update departments |

#### Conflict and equipment operations

| Base path | Endpoint | Purpose |
| --- | --- | --- |
| `/api/conflicts` | `POST /check` | General request conflict check |
| `/api/equipment-conflicts` | `POST /conflicts` | Equipment conflict check |
| `/api/equipment-conflicts` | `GET /availability` | Equipment availability for a time/resource selection |
| `/api/equipment-adjustments` | `POST /adjust-equipment` | Admin equipment adjustment |
| `/api/equipment-adjustments` | `POST /:notificationId/respond` | Respond to an adjustment notification |

#### Notifications — `/api/notifications`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Current user's notifications |
| GET | `/unread-count` | Current unread count |
| PATCH | `/read-all` | Mark all current notifications read |
| PATCH | `/:id/read` | Mark one notification read |

#### Reports — `/api/reports`

All report endpoints return PDF data and are admin-protected:

- `GET /borrow-requests.pdf`
- `GET /demand-analysis.pdf`
- `GET /lab-schedules.pdf`
- `GET /equipment.pdf`

The frontend supplies period, date, status, role, room, program, year,
schedule type, inventory, demand, and grouping filters depending on the report.

#### Academic periods and audit logs

| Base path | Endpoints | Purpose |
| --- | --- | --- |
| `/api/academic-period` | `GET /`, `GET /current`, `POST /` | Read and activate academic year/term context |
| `/api/audit-logs` | `GET /` | Search and paginate administrative audit logs |

### Operational endpoints

- `GET /health` returns API status, timestamp, service name, and version.
- `GET /api/test-db` tests the Prisma/PostgreSQL connection and returns a
  user count.

---

## 7. Database Design

The database provider is PostgreSQL and Prisma is the schema source of truth.
The current schema contains 17 models and 6 enums.

### Enums

- `UserRole`: `ADMIN`, `FACULTY`, `STUDENT`
- `UserStatus`: `ACTIVE`, `DEACTIVATED`
- `EquipmentStatus`: `AVAILABLE`, `BORROWED`, `DAMAGED`, `UNAVAILABLE`
- `RequestStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `RETURNED`,
  `BORROWED`
- `ScheduleType`: `ONE_TIME`, `WEEKLY`
- `NotificationType`: request approval, request rejection, pending request,
  equipment due, system announcement, schedule reminder

### Models

#### Academic directory

- `AcademicYear` — year label and active flag; linked to schedules and requests
- `Term` — term name and active flag; linked to schedules and requests
- `Building` — building name and rooms
- `Room` — room number/name, building, and computer-lab flag
- `Program` — academic code/name and linked students/schedules/requests
- `Subject` — subject code/name and linked schedules/requests
- `Department` — faculty department

#### Identity and profiles

- `User` — email, password hash, identity fields, role, status, and timestamps
- `AdminProfile` — one-to-one admin extension
- `FacultyProfile` — one-to-one faculty extension and department relation
- `StudentProfile` — one-to-one student extension, program, and year level

#### Operations

- `Equipment` — quantities for total, available, borrowed, and damaged stock
- `LabSchedule` — schedule type, room, faculty, academic context, date/time,
  and optional borrow-request relation
- `BorrowRequest` — requester, faculty/program/subject/room context, requested
  date/time, academic context, status, lifecycle timestamps, and items
- `BorrowRequestItem` — equipment and quantity per borrow request
- `Notification` — user, type, message, read state, email state, and references
- `AuditLog` — actor, action, entity, JSON details, and timestamp

Most optional academic/room relations use `SetNull` on deletion. Profile
relations generally cascade from their owning user. Borrow-request items
cascade from their parent request.

### Seed data

`backend/prisma/seed.ts` creates or upserts development/reference data,
including:

- Admin, faculty, and student users
- Departments and programs
- Academic years and terms
- Buildings and rooms
- Subjects
- Equipment
- Report fixtures used for report development

The development seed accounts and their credentials are defined in the seed
file. They are for local/demo use only and must not be reused in production.

---

## 8. Authentication and Authorization

The authentication flow is:

1. The user submits credentials on the landing page.
2. `POST /api/auth/login` validates the user and password.
3. The backend returns a JWT and user object.
4. The frontend stores the token under `localStorage["token"]` and persists
   auth state through Zustand.
5. Axios attaches the token to API requests.
6. The backend verifies the token and reloads the user from PostgreSQL on each
   protected request.
7. `ProtectedRoute` enforces frontend role routing, while backend
   `authorizeRoles` enforces API authorization.

JWTs currently expire after 24 hours. Logout removes the token from
localStorage and clears the frontend auth state.

Security considerations for future production work:

- Keep `DATABASE_URL`, `JWT_SECRET`, SMTP passwords, and any other credentials
  in Replit Secrets or an equivalent secret manager.
- Do not commit real SMTP passwords or production JWT values.
- Restrict CORS origins for production; the current server intentionally allows
  all origins in development.
- Replace or rotate seeded development credentials before production use.
- Review the localStorage JWT strategy if stronger session protection is
  required.

---

## 9. Environment Configuration

Only variable names are listed here. Secret values must not be placed in this
document.

### Required or normally expected

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Backend/Prisma | PostgreSQL connection string; normally injected by Replit Database |
| `PORT` | Backend | Express port; development default is 3001 |
| `NODE_ENV` | Backend | Runtime environment |
| `JWT_SECRET` | Backend | JWT signing and verification |
| `FRONTEND_URL` | Backend | CORS configuration |

### Email

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_SECURE` | SMTP TLS mode |
| `SMTP_USER` | SMTP account |
| `SMTP_PASS` | SMTP password/app password; optional in local development |
| `SMTP_FROM` | Sender identity |

If `SMTP_PASS` is missing, the email service logs a warning and email
notifications are disabled; in-app notifications still remain available.

### Frontend and reporting options

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Overrides the frontend Axios base URL; defaults to `/api` |
| `CHROMIUM_PATH` | Chromium executable used for server-side PDF generation |
| `FRONTEND_PUBLIC_DIR` | Optional output/static directory used by report rendering |
| `RESET_TEST_DATABASE` | Test/reset behavior flag used by test helpers |

The development Replit configuration points Chromium at
`/repl/tools/bin/chromium`. If that path is not available in another
environment, set `CHROMIUM_PATH` to an installed Chromium executable.

---

## 10. Running the Project

### Prerequisites

- Node.js 20
- npm
- PostgreSQL, normally supplied through Replit Database
- Chromium for PDF report export
- SMTP credentials only if email delivery is needed

### Install all packages

From the repository root:

```bash
npm run install:all
```

This installs root, backend, and frontend dependencies.

### Prepare the database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

`db:push` synchronizes the PostgreSQL database directly from
`backend/prisma/schema.prisma`. This project currently uses Prisma schema push
for development rather than a committed migration history.

### Start both applications

```bash
npm run dev
```

This runs:

- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`

The configured Replit `Project` workflow runs the frontend and backend in
parallel. The individual workflows are:

- **Start application** — installs frontend dependencies and starts Vite on
  port 5000
- **Backend API** — installs backend dependencies, generates Prisma client,
  pushes the schema, seeds data, and starts Nodemon on port 3001

### Development URLs

- Frontend: `http://localhost:5000`
- Backend health: `http://localhost:3001/health`
- Database test: `http://localhost:3001/api/test-db`
- API base from frontend: `/api`, proxied by Vite to port 3001

### Build and production start

```bash
npm run build
npm run start
```

Build steps:

1. Compile the backend with TypeScript into `backend/dist`.
2. Build the frontend with TypeScript and Vite into its frontend build output.

The Replit deployment configuration builds both packages but starts
`backend/dist/server.js`. Confirm the production serving/static-file strategy
before publishing if the backend is expected to serve the built frontend from
the same process; the development setup is explicitly two-process.

---

## 11. Available Scripts

### Root scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run frontend and backend together |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build backend and frontend |
| `npm run build:backend` | Build backend |
| `npm run build:frontend` | Build frontend |
| `npm run start` | Start compiled backend |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed development data |
| `npm run install:all` | Install all workspace packages |
| `npm run clean` | Remove generated dependencies/build output |

### Frontend scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite |
| `npm run build` | Type-check and build frontend |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the frontend build |

### Backend scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Nodemon with `src/server.ts` |
| `npm run build` | Compile backend TypeScript |
| `npm run start` | Start `dist/server.js` |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push Prisma schema |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Run the seed script |
| `npm run db:reset:test` | Reset the test database helper |
| `npm test` | Run all backend tests |
| `npm run test:auth` | Run auth tests |
| `npm run test:equipment` | Run equipment tests |
| `npm run test:users` | Run user tests |
| `npm run test:borrow` | Run borrow-request tests |
| `npm run test:schedules` | Run schedule tests |
| `npm run test:directory` | Run academic-directory tests |
| `npm run test:notifications` | Run notification tests |
| `npm run test:conflicts` | Run conflict tests |
| `npm run test:realistic` | Run the realistic user-journey test |

---

## 12. Testing

Backend tests are in `backend/tests/`. The current suites cover:

- Authentication
- Users
- Equipment
- Borrow requests
- Laboratory schedules
- Academic directory
- Notifications
- Conflict detection
- A realistic multi-step user journey

`docs/project-test-plan.md` contains a much broader page and interaction
checklist for frontend/manual or future browser automation testing. It covers:

- Landing page navigation
- Login input, validation, loading, and failure behavior
- Role-specific redirects
- Protected route behavior
- Student request creation and equipment selection
- Notifications
- Schedule table, chart, and calendar views
- Responsive behavior
- Accessibility and keyboard interaction

There is no dedicated frontend test script in `frontend/package.json`; frontend
verification is currently primarily build/lint plus the documented manual test
plan.

---

## 13. Design and UX System

The interface uses a PUP-inspired institutional treatment:

- Primary maroon
- Gold accent
- Blue, green, orange, red, and neutral status colors
- Inter/system typography
- Responsive mobile-first layouts
- Shared cards, tables, drawers, dialogs, filters, ribbons, tabs, and toasts

The shared-control-ribbon work is documented in the control ribbon planning and
checklist files under `docs/`. Operational pages use compact shared controls
for search, filtering, date range, academic period, and page actions.

Admin print/export views use an institutional form treatment with
Philippine-long-bond landscape sizing. Preserve that pattern when adding new
administrative reports.

---

## 14. Important Domain Rules

- Only the owning role's portal should be reachable from the frontend.
- Backend authorization remains the security boundary; frontend route guards
  are not sufficient by themselves.
- Borrow requests move through the lifecycle represented by `RequestStatus`.
- Inventory quantities must remain consistent across total, available, borrowed,
  and damaged counts.
- Schedule and equipment checks must account for local Manila time rather than
  comparing raw UTC clock strings.
- Academic year and term are part of schedule and borrow-request context.
- Room conflicts and equipment availability are checked before approval or
  submission where relevant.
- Request status changes can create in-app notifications, email notifications,
  audit records, and equipment/schedule side effects.
- PDF report filters and report scope are implemented in both the frontend
  report UI and backend report route/service logic.

---

## 15. Existing Documentation

| File | Contents |
| --- | --- |
| `REPLIT.md` | Replit setup, workflows, environment, PDF notes, and project onboarding |
| `backend/API.md` | Existing endpoint reference; verify against route source for current details |
| `docs/development-guide.md` | General architecture, styling, workflow, and development guidance |
| `docs/component-guide.md` | Component conventions and design guidance |
| `docs/project-test-plan.md` | Detailed frontend and user-flow test checklist |
| `docs/CHANGELOG.md` | Project history and release notes |
| `docs/reusable-table-standardization-plan.md` | Table consistency and reuse plan |
| `docs/control-ribbon-implementation-plan.md` | Shared control ribbon architecture and rollout |
| `docs/control-ribbon-checklist.md` | Control ribbon implementation checklist |
| `docs/control-ribbon-consistency-baseline.md` | Baseline findings |
| `docs/control-ribbon-consistency-fix-plan.md` | Phased consistency fix plan |

Some older documents describe an earlier starter architecture or older package
versions. Use the current `package.json` files, `frontend/src/main.tsx`,
`backend/src/server.ts`, and `backend/prisma/schema.prisma` as the primary
references.

---

## 16. Handoff Checklist

Before taking over active development:

- [ ] Confirm a PostgreSQL database is available and `DATABASE_URL` is supplied.
- [ ] Confirm all workspace packages install successfully.
- [ ] Run Prisma client generation and schema push.
- [ ] Run the seed script in a development database only.
- [ ] Start both workflows and check `/health`.
- [ ] Check that frontend `/api` requests reach the backend.
- [ ] Test login for each role using the development seed data.
- [ ] Verify role redirects and protected routes.
- [ ] Run the backend Jest suites.
- [ ] Run the frontend build and lint commands.
- [ ] Verify PDF export with a working Chromium executable.
- [ ] Configure `SMTP_PASS` only if email delivery is required.
- [ ] Before production, rotate development credentials, use production secrets,
  restrict CORS, and review deployment static-file serving.

---

## 17. Known Caveats and Follow-up Areas

1. **Development and production serving differ.** Development uses separate
   Vite and Express processes. The deployment command starts the compiled
   backend, so production frontend serving should be confirmed before release.
2. **Schema push is used instead of migrations.** This is convenient for
   development but should be replaced or formalized with a production-safe
   migration process if the database becomes persistent.
3. **Some documentation is historical.** Existing guides contain older
   starter-template descriptions and package versions.
4. **Frontend test automation is incomplete.** The manual test plan is broad,
   but `frontend/package.json` has no frontend test command.
5. **Email is optional in local development.** Missing SMTP password disables
   email delivery while leaving in-app notifications available.
6. **Secret hygiene needs production review.** All production credentials and
   signing keys should be managed through secrets and should not be committed
   to repository files.
7. **Report rendering depends on Chromium.** PDF export requires an executable
   Chromium path available in the runtime.
