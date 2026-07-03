# Data Model

Entities are split across the **master** database (auth/routing) and each
**tenant** database (clinical data). See [architecture.md](architecture.md) for
why the split exists.

## Master database (`hospital_master`)

### `tenants` — a hospital
`database/master/entities/tenant.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `name` | varchar(200) | |
| `slug` | varchar(100), **unique** | URL/DB-safe id (e.g. `st-marys`); tenant DB = `hospital_tenant_<slug>` |
| `address`, `phone`, `email` | nullable | Contact details |
| `isActive` | bool (default true) | |
| `createdAt` / `updatedAt` | timestamps | |

### `auth_users` — central login registry (ALL roles)
`database/master/entities/auth-user.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `email` | varchar(200), **unique index** | Normalised lower-case |
| `fullName` | varchar(200) | |
| `passwordHash` | varchar(200), nullable | bcrypt; **null** until invite completed / Google-only |
| `googleId` | varchar(200), nullable | Bound on first Google login |
| `role` | enum `Role` | `SUPER_ADMIN` / `HOSPITAL_ADMIN` / `DOCTOR` / `PATIENT` |
| `tenantId` | uuid, nullable | Null for `SUPER_ADMIN` |
| `tenantSlug` | varchar(100), nullable | Denormalised so requests resolve the tenant DB without a lookup; travels on the JWT |
| `profileId` | uuid, nullable | `doctors.id` / `patients.id` in the tenant DB (null for admins) |
| `isActive` | bool (default true) | Inactive users cannot log in |
| `createdAt` / `updatedAt` | timestamps | |

### `refresh_tokens` — rotating session tokens
`database/master/entities/refresh-token.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `authUserId` | uuid, indexed | Owner |
| `tokenHash` | varchar(64), **unique index** | SHA-256 of the raw token (raw value never stored) |
| `expiresAt` | timestamptz | Default 7 days |
| `revokedAt` | timestamptz, nullable | Set on rotation/logout |
| `createdAt` | timestamp | |

See [authentication.md](authentication.md) for rotation semantics.

### `invitations` — single-use set-password links
`database/master/entities/invitation.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `authUserId` | uuid, indexed | Account being onboarded |
| `email` | varchar(200) | |
| `tokenHash` | varchar(64), **unique index** | SHA-256 of the raw token |
| `expiresAt` | timestamptz | Default 72h |
| `usedAt` | timestamptz, nullable | Set when consumed (single-use) |
| `createdAt` | timestamp | |

See [account-provisioning-and-invitations.md](account-provisioning-and-invitations.md).

## Tenant database (`hospital_tenant_<slug>`)

Registered for every tenant DataSource via
`database/tenant/tenant-entities.ts` (`TENANT_ENTITIES`).

### `doctors`
`database/tenant/entities/doctor.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | This is the `profileId` on the master login |
| `authUserId` | uuid, **unique index** | → `auth_users.id` (master) |
| `fullName` | varchar(200) | |
| `email` | varchar(200), **unique index** | Mirrors the login email |
| `phone` | nullable | |
| `specialization` | varchar(150) | |
| `licenseNumber` | nullable | |
| `isActive` | bool (default true) | |
| `createdAt` / `updatedAt` | timestamps | |

### `patients`
`database/tenant/entities/patient.entity.ts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | The `profileId` on the master login |
| `authUserId` | uuid, **unique index** | → `auth_users.id` (master) |
| `fullName`, `email` (**unique**), `phone` | | |
| `dateOfBirth` | date, nullable | |
| `gender`, `bloodGroup`, `address` | nullable | |
| `isActive` | bool (default true) | |
| `createdAt` / `updatedAt` | timestamps | |

### `appointments`
`database/tenant/entities/appointment.entity.ts` — see
[appointments.md](appointments.md).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid (PK) | |
| `doctorId` | uuid, indexed, FK → `doctors` **ON DELETE CASCADE** | |
| `patientId` | uuid, indexed, FK → `patients` **ON DELETE CASCADE** | |
| `scheduledAt` | timestamptz, indexed | Slot start (UTC) |
| `durationMinutes` | int (default 30) | Slot length |
| `status` | enum `AppointmentStatus` | `SCHEDULED` default |
| `reason` | varchar(300) | Required |
| `notes` | text, nullable | |
| `createdAt` / `updatedAt` | timestamps | |

## Cross-database references (no SQL FKs)

`auth_users` (master) and `doctors`/`patients` (tenant) live in **different
databases**, so the links between them **cannot** be SQL foreign keys. They are
maintained by application code and kept bidirectional:

```
auth_users.profileId   ─────────▶  doctors.id / patients.id
auth_users.tenantSlug  ─────────▶  which tenant DB
doctors.authUserId     ─────────▶  auth_users.id
patients.authUserId    ─────────▶  auth_users.id
```

Consistency rules the app upholds:
- **Create**: master login first (password-less) → tenant profile → link
  `profileId`; roll back the login if the profile insert fails.
- **Update**: profile edits that change email/name/active state are mirrored to
  the master login (`AccountsService.updateLogin`).
- **Delete doctor/patient**: delete the profile (appointments cascade in-DB via
  FK) **and** delete the master login (`AccountsService.deleteLogin`).
- **Delete tenant**: delete all master logins for the tenant
  (`deleteAllForTenant`), then drop the tenant database.

Within a tenant DB, deleting a doctor or patient **cascades** to their
appointments via the `ON DELETE CASCADE` foreign keys above.

## Seed data

`npm run seed` (`seed/seed.ts`) is idempotent — it drops and recreates the demo
tenants each run. It creates:

- One `SUPER_ADMIN`: `superadmin@hospital.io`
- Two hospitals — **St. Mary's** (`st-marys`) and **Riverside** (`riverside`) —
  each with a `HOSPITAL_ADMIN` (`admin@stmarys.io`, `admin@riverside.io`),
  several doctors and patients, and sample appointments.
- **Every** seeded account shares the password from `SEED_DEFAULT_PASSWORD`
  (default `Password123!`) — seeded accounts are pre-activated with a password
  and therefore bypass the invitation flow, so you can log in immediately.

## Key files

| Concern | File |
| --- | --- |
| Master entities | `database/master/entities/*.ts` |
| Tenant entities | `database/tenant/entities/*.ts` |
| Tenant entity registration | `database/tenant/tenant-entities.ts` |
| Seed script | `seed/seed.ts` (reset: `seed/reset.ts`) |
