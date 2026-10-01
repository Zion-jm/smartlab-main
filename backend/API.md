# SmartLab 2.0 API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login user |
| GET | `/auth/me` | ✅ | Get current user |

### Equipment
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/equipment` | Public | List all equipment |
| GET | `/equipment/:id` | Public | Get equipment details |
| POST | `/equipment` | Admin | Create equipment |
| PUT | `/equipment/:id` | Admin | Update equipment |
| DELETE | `/equipment/:id` | Admin | Delete equipment |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | Admin | List all users |
| GET | `/users/:id` | ✅ | Get user (own/admin) |
| PUT | `/users/:id` | ✅ | Update user (own/admin) |

### Borrow Requests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/borrow-requests` | Admin | List all requests |
| GET | `/borrow-requests/my-requests` | ✅ | Get my requests |
| POST | `/borrow-requests` | ✅ | Create request |
| PATCH | `/borrow-requests/:id/approve` | Admin | Approve request |
| PATCH | `/borrow-requests/:id/reject` | Admin | Reject request |
| PATCH | `/borrow-requests/:id/borrow` | Admin | Mark as borrowed |
| PATCH | `/borrow-requests/:id/return` | Admin | Mark as returned |
| PATCH | `/borrow-requests/:id/cancel` | ✅ | Cancel my request |

### Lab Schedules
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/lab-schedules` | Admin/Faculty | List schedules |
| POST | `/lab-schedules/admin/create` | Admin | Create schedule directly |
| POST | `/lab-schedules/request` | Faculty | Request schedule |
| GET | `/lab-schedules/check-conflicts/:id` | Admin | Check conflicts |
| PATCH | `/lab-schedules/approve-request/:id` | Admin | Approve & create schedule |

## User Roles
- **ADMIN**: Full access, approve requests, manage everything
- **FACULTY**: Request schedules, view equipment
- **STUDENT**: Create borrow requests, view own requests

## Request Status Flow
```
PENDING → APPROVED → BORROWED → RETURNED
   ↓        ↓         ↓
CANCELLED REJECTED  (any time)
```
