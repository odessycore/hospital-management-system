# Roles & Permissions

The system has **four roles** (`common/enums/role.enum.ts`). `SUPER_ADMIN` is a
platform-global role; the other three are **tenant-scoped** — they belong to
exactly one hospital and can only ever act within it.

```ts
enum Role { SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, PATIENT }
const TENANT_SCOPED_ROLES = [HOSPITAL_ADMIN, DOCTOR, PATIENT];
```

## Capability matrix

| Role | Scope | Capabilities |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform | CRUD hospitals (tenants); view per-hospital stats, doctor & patient listings; resend a hospital admin's invite. **Does not** touch clinical data directly. |
| `HOSPITAL_ADMIN` | One hospital | Dashboard stats; CRUD doctors & patients; create/manage appointments; resend doctor/patient invites. |
| `DOCTOR` | One hospital | **Read-only**: view own upcoming appointments & history. |
| `PATIENT` | One hospital | **Read-only**: view own upcoming appointments & history. |

`DOCTOR` and `PATIENT` are deliberately read-only — they consume schedules but do
not modify them.

## How authorisation is enforced

Authorisation is layered; a request must pass every layer:

### 1. Authentication — `JwtAuthGuard` (global)
Every route needs a valid JWT unless `@Public()`. The JWT payload provides
`role`, `tenantId`, `tenantSlug`, and `profileId` without a DB round-trip. See
[authentication.md](authentication.md).

### 2. Role check — `RolesGuard` + `@Roles(...)`
`common/guards/roles.guard.ts` reads `@Roles(...)` metadata from the handler or
controller. If present, `req.user.role` must be in the allowed set or the request
gets `403`. No `@Roles` = any authenticated user.

```ts
@Controller('doctors')
@UseInterceptors(TenantInterceptor)
@Roles(Role.HOSPITAL_ADMIN)          // ← whole controller is admin-only
export class DoctorsController { ... }
```

### 3. Tenant isolation — `TenantInterceptor`
On tenant-scoped controllers, the interceptor pins the request to the caller's
own tenant database via `req.user.tenantSlug`
(see [architecture.md](architecture.md)). This is what makes tenant scoping
**structural** rather than a matter of remembering a `WHERE tenantId = ?` clause:
a `HOSPITAL_ADMIN` for St. Mary's is physically connected to the St. Mary's
database and cannot address another hospital's data at all.

### 4. Row scoping for DOCTOR / PATIENT
Within a tenant, doctors and patients must see **only their own** appointments.
`AppointmentsService.listForUser` narrows the query by `req.user.profileId`:

```ts
if (user.role === Role.DOCTOR)  qb.andWhere('a.doctorId = :pid',  { pid: user.profileId });
else if (user.role === Role.PATIENT) qb.andWhere('a.patientId = :pid', { pid: user.profileId });
// HOSPITAL_ADMIN: no narrowing → every appointment in the tenant
```

`profileId` comes from the JWT and maps to `doctors.id` / `patients.id` in the
tenant DB. So the four checks compose as: **who are you (JWT) → are you allowed
this action (role) → in which hospital (tenant DB) → which rows (profileId)**.

## Controller → role/scope map

| Controller | Roles | Tenant-scoped? |
| --- | --- | --- |
| `AuthController` (`/auth`) | Public / any authenticated (`/me`) | No |
| `TenantsController` (`/tenants`) | `SUPER_ADMIN` | No (reaches into tenant DBs for stats) |
| `DoctorsController` (`/doctors`) | `HOSPITAL_ADMIN` | Yes |
| `PatientsController` (`/patients`) | `HOSPITAL_ADMIN` | Yes |
| `AppointmentsController` (`/appointments`) | `HOSPITAL_ADMIN`, `DOCTOR`, `PATIENT` | Yes |
| `StatsController` (`/stats/hospital`) | `HOSPITAL_ADMIN` | Yes |
| `InvitationsController` (`/auth/invitation`, `/auth/set-password`) | Public | No |

## Key files

| Concern | File |
| --- | --- |
| Role enum & tenant-scoped set | `common/enums/role.enum.ts` |
| Role guard | `common/guards/roles.guard.ts` |
| `@Roles()` decorator | `common/decorators/roles.decorator.ts` |
| Per-user appointment scoping | `appointments/appointments.service.ts` (`listForUser`) |
| Authenticated user shape | `common/interfaces/authenticated-user.interface.ts` |
