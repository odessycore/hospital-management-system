# Medisys — Multi-Tenant Hospital Management System

A production-style, multi-tenant hospital management platform. Each **tenant is a
hospital** and gets its **own isolated PostgreSQL database** (database-per-tenant
isolation). A small central "master" database handles authentication routing and
the tenant registry.

- **Backend** — NestJS + TypeORM + PostgreSQL
- **Frontend** — React + Vite + TypeScript + Tailwind CSS + TanStack Query
- **Auth** — Custom email/password **and** Google OAuth 2.0, short-lived JWT
  access tokens + long-lived rotating cryptographic refresh tokens. **No signup** —
  accounts are provisioned by administrators only.

---

## Roles

| Role             | Scope       | Capabilities                                                                 |
| ---------------- | ----------- | ---------------------------------------------------------------------------- |
| `SUPER_ADMIN`    | Platform    | CRUD hospitals (tenants); view per-hospital stats, doctor & patient listings |
| `HOSPITAL_ADMIN` | One hospital| Dashboard stats; CRUD doctors & patients; create/manage appointments         |
| `DOCTOR`         | One hospital| **Read-only**: view own upcoming appointments & history                      |
| `PATIENT`        | One hospital| **Read-only**: view own upcoming appointments & history                      |

`HOSPITAL_ADMIN`, `DOCTOR`, and `PATIENT` are tenant-scoped; `SUPER_ADMIN` is global.

---

## Architecture: tenancy & authentication

Because every hospital has a **separate database**, a small central **`auth_users`**
registry in the master DB stores only what's needed to authenticate and route a
login to the correct tenant database (email, password hash, Google id, role,
tenant reference, and a pointer to the profile row in the tenant DB). All clinical
and profile data (`doctors`, `patients`, `appointments`) lives **only** in the
per-tenant database.

```
┌────────────────────── master DB (hospital_master) ──────────────────────┐
│  tenants          auth_users               refresh_tokens                │
│  (hospitals)      (login registry, all     (hashed, rotating)            │
│                    roles → tenant + role)                                │
└──────────────────────────────────────────────────────────────────────────┘
        │ slug                         │ tenantSlug on the JWT
        ▼                              ▼
┌── hospital_tenant_st-marys ──┐  ┌── hospital_tenant_riverside ──┐
│  doctors  patients           │  │  doctors  patients            │
│  appointments                │  │  appointments                 │
└──────────────────────────────┘  └───────────────────────────────┘
```

At runtime the JWT carries `tenantSlug`; a `TenantInterceptor` lazily opens (and
caches) a TypeORM `DataSource` to that hospital's database and injects it into the
request. Cross-tenant access is impossible because a request can only ever touch
its own tenant's database.

---

## Prerequisites

- **Node.js** ≥ 18 (tested on 24)
- **PostgreSQL** ≥ 14, running locally
- A PostgreSQL role **with the `CREATEDB` privilege** (used to provision tenant DBs)

Create the role once (adjust to taste — must match `backend/.env`):

```sql
CREATE ROLE hospital WITH LOGIN PASSWORD 'hospital_pass' CREATEDB;
```

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit DB creds / secrets / Google OAuth
npm install
npm run seed                  # creates master + 2 tenant DBs with demo data
npm run start:dev             # http://localhost:3000/api
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL defaults to http://localhost:3000/api
npm install
npm run dev                   # http://localhost:5173
```

Open **http://localhost:5173** and sign in with a demo account below.

---

## Demo credentials

The seed creates two hospitals fully populated with staff, patients and
appointments. **Password for every demo account:** `Password123!`

| Role           | Email                       | Hospital                    |
| -------------- | --------------------------- | --------------------------- |
| Super Admin    | `superadmin@hospital.io`    | —                           |
| Hospital Admin | `admin@stmarys.io`          | St. Mary's General Hospital |
| Hospital Admin | `admin@riverside.io`        | Riverside Medical Center    |
| Doctor         | `alan.grant@stmarys.io`     | St. Mary's General Hospital |
| Doctor         | `meredith.grey@riverside.io`| Riverside Medical Center    |
| Patient        | `john.hammond@example.com`  | St. Mary's General Hospital |
| Patient        | `george.omalley@example.com`| Riverside Medical Center    |

The login screen also has one-click buttons to prefill each demo role.

---

## Google OAuth

Google login works once you set real credentials in `backend/.env`:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

Add the callback URL as an **Authorized redirect URI** in the Google Cloud
console. Since there is no signup, the Google account's email must already exist
in `auth_users` (i.e. an admin must have created it) or login is rejected.

---

## Useful scripts

**Backend**

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `npm run start:dev`| Start API in watch mode                            |
| `npm run build`    | Compile to `dist/`                                 |
| `npm run seed`     | (Re)seed master + tenant databases (idempotent)    |
| `npm run db:reset` | Drop the master DB and **all** tenant DBs          |

**Frontend**

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Vite dev server                |
| `npm run build`   | Type-check + production build  |
| `npm run preview` | Preview the production build   |

---

## API overview

All routes are prefixed with `/api`. Every route requires a `Bearer` access token
except those marked public.

| Method & path                     | Role(s)                         | Purpose                          |
| --------------------------------- | ------------------------------- | -------------------------------- |
| `POST /auth/login` (public)       | any                             | Email/password login             |
| `POST /auth/refresh` (public)     | any                             | Rotate tokens                    |
| `POST /auth/logout` (public)      | any                             | Revoke a refresh token           |
| `GET  /auth/google` (public)      | any                             | Start Google OAuth               |
| `GET  /auth/me`                   | any                             | Current identity                 |
| `GET/POST/PATCH/DELETE /tenants`  | `SUPER_ADMIN`                   | Hospital CRUD                    |
| `GET  /tenants/:id/stats`         | `SUPER_ADMIN`                   | Per-hospital stats & listings    |
| `GET  /stats/hospital`            | `HOSPITAL_ADMIN`                | Own hospital dashboard           |
| `... /doctors`, `... /patients`   | `HOSPITAL_ADMIN`                | Doctor / patient CRUD            |
| `GET  /appointments`              | `HOSPITAL_ADMIN/DOCTOR/PATIENT` | Role-scoped list (`?view=`)      |
| `POST/PATCH/DELETE /appointments` | `HOSPITAL_ADMIN`                | Manage appointments              |

> **Note:** For development, both master and tenant schemas use TypeORM
> `synchronize: true`. For production, switch to migrations.
