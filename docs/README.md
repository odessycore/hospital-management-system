# Medisys — Documentation

Deep-dive documentation for the Medisys multi-tenant hospital management system.
These docs describe **how the system actually works** (flows, invariants, and the
reasoning behind key decisions); the root [`README.md`](../README.md) covers
features, setup, and how to run it.

| Doc | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Database-per-tenant model, master vs. tenant DBs, request lifecycle, `TenantInterceptor` connection routing |
| [authentication.md](authentication.md) | Login (password + Google OAuth), JWT access tokens, rotating refresh tokens, guards |
| [roles-and-permissions.md](roles-and-permissions.md) | The four roles, what each can do, and how the guards enforce it |
| [account-provisioning-and-invitations.md](account-provisioning-and-invitations.md) | How accounts are created (no signup), the set-password email invitation flow, resend/rotation |
| [appointments.md](appointments.md) | Scheduling rules: past-time rejection and doctor/patient overlap (hard block) |
| [data-model.md](data-model.md) | Every entity, which database it lives in, and how the two databases stay in sync |

## The 60-second mental model

- **A tenant is a hospital.** Every hospital gets its **own physical PostgreSQL
  database** (`hospital_tenant_<slug>`). Clinical data never mixes.
- A small **master database** (`hospital_master`) holds only what's needed to
  **authenticate and route** a login: the tenant registry, the `auth_users`
  login registry (all roles), refresh tokens, and invitations.
- Every JWT carries a `tenantSlug`. On each tenant-scoped request the
  `TenantInterceptor` lazily opens (and caches) a connection to that hospital's
  database. **A request can only ever touch its own tenant's DB**, so
  cross-tenant access is structurally impossible.
- **There is no signup.** Admins provision accounts; users receive an email
  invitation and set their own password.
