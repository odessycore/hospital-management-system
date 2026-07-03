# Architecture: Tenancy & Request Lifecycle

Medisys uses **database-per-tenant** isolation: each hospital (tenant) has its
own physical PostgreSQL database. A single small **master** database handles
authentication and tenant routing.

## Why database-per-tenant

- **Hard isolation.** A hospital's clinical data (`doctors`, `patients`,
  `appointments`) lives *only* in that hospital's database. There is no
  `tenantId` column to forget on a query and no row-level-security policy to
  misconfigure — a query physically cannot reach another tenant's rows because
  it runs against a different database connection.
- **Blast radius.** Corruption, a bad migration, or a `DROP` affects one
  hospital, not all of them.
- **Trade-off.** More connections and schema copies to manage. Acceptable here
  because the tenant count is modest and isolation is the priority.

## The two database tiers

```
┌────────────────────── master DB: hospital_master ──────────────────────┐
│  tenants           auth_users            refresh_tokens    invitations  │
│  (hospitals)       (login registry,      (hashed,          (hashed,     │
│                     ALL roles →           rotating)         single-use)  │
│                     tenant + role)                                      │
└─────────────────────────────────────────────────────────────────────────┘
        │ slug                          │ tenantSlug (denormalised on auth_users
        ▼                               ▼          and carried on the JWT)
┌── hospital_tenant_st-marys ──┐   ┌── hospital_tenant_riverside ──┐
│  doctors   patients          │   │  doctors   patients           │
│  appointments                │   │  appointments                 │
└──────────────────────────────┘   └───────────────────────────────┘
```

**Master DB** (`config: db.masterName`, default `hospital_master`) holds only
authentication/routing data — see [data-model.md](data-model.md):
`tenants`, `auth_users`, `refresh_tokens`, `invitations`.

**Tenant DB** (`${db.tenantPrefix}${slug}`, e.g. `hospital_tenant_st-marys`)
holds all clinical/profile data: `doctors`, `patients`, `appointments`.

The link between the two tiers:
- `auth_users.tenantId` / `auth_users.tenantSlug` point a login at its hospital.
- `auth_users.profileId` points at the `doctors.id` / `patients.id` row in the
  tenant DB (null for `SUPER_ADMIN` and `HOSPITAL_ADMIN`).
- `doctors.authUserId` / `patients.authUserId` point back at the master login.

Because these cross-database references can't be enforced with SQL foreign keys,
the application keeps them in sync (see
[account-provisioning-and-invitations.md](account-provisioning-and-invitations.md)).

## Connection management — `TenantConnectionService`

`backend/src/database/tenant/tenant-connection.service.ts` owns the lifecycle of
every tenant DataSource:

- **`getConnection(slug)`** — returns a cached, initialised TypeORM `DataSource`
  for a tenant. Connections are cached in an in-memory `Map<slug, DataSource>`,
  so at most **one connection pool per tenant** is ever opened. First access for
  a slug opens the pool; subsequent requests reuse it.
- **`provisionDatabase(slug)`** — connects to the bootstrap DB (`db.bootstrapName`,
  default `postgres`), runs `CREATE DATABASE "hospital_tenant_<slug>"` if it does
  not already exist (idempotent), then opens a synchronised connection so TypeORM
  creates the schema. Requires the DB role to have the **`CREATEDB`** privilege.
- **`dropDatabase(slug)`** — terminates other sessions on the tenant DB, then
  `DROP DATABASE IF EXISTS`. Used when a tenant is deleted.
- **`onModuleDestroy`** — destroys all cached DataSources on shutdown.

> **Schema management.** Tenant DataSources are opened with
> `synchronize: true` — convenient for development, where TypeORM auto-creates
> tables from the entities. For production you would switch to migrations.

## Request lifecycle (tenant-scoped route)

For a request like `GET /api/appointments`:

1. **`JwtAuthGuard`** (global, registered in `app.module.ts` via `APP_GUARD`)
   validates the access token unless the route is `@Public()`. The decoded JWT
   payload is attached as `req.user` (shape: `AuthenticatedUser`).
2. **`RolesGuard`** checks any `@Roles(...)` requirement on the controller/handler.
3. **`TenantInterceptor`** (applied with `@UseInterceptors(TenantInterceptor)`
   on tenant-scoped controllers) reads `req.user.tenantSlug`, calls
   `connections.getConnection(slug)`, and attaches the result as
   `req.tenantDataSource`. If the user has no `tenantSlug` (e.g. a `SUPER_ADMIN`
   hitting a tenant route) it throws `403`.
4. The **controller handler** receives the tenant DataSource via the
   `@TenantDataSource()` param decorator and passes it to the service, which
   runs all queries against that hospital's database.

```
Request ──▶ JwtAuthGuard ──▶ RolesGuard ──▶ TenantInterceptor ──▶ Controller
            (authn)          (authz)         (req.tenantDataSource)   │
                                                                      ▼
                                              Service(ds).query(...)  ──▶ tenant DB
```

Routes that operate on **master** data instead (`/auth/*`, `/tenants/*`) do not
use the `TenantInterceptor`; their services inject master-DB repositories
directly. Super-admin stats reach into tenant DBs on demand via
`TenantConnectionService.getConnection` (see `tenants.service.ts`).

## Global bootstrap (`main.ts`)

- Global route prefix `api` (`config: apiPrefix`).
- CORS restricted to `config.frontendUrl` with credentials enabled.
- A global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and
  `transform` — DTOs are the single source of truth for request shape.

## Key files

| Concern | File |
| --- | --- |
| Tenant connection cache / provisioning | `database/tenant/tenant-connection.service.ts` |
| Attach tenant DataSource to request | `database/tenant/tenant.interceptor.ts` |
| `@TenantDataSource()` param decorator | `common/decorators/tenant-datasource.decorator.ts` |
| Tenant entity list for DataSources | `database/tenant/tenant-entities.ts` |
| Master DB module | `database/master/master-database.module.ts` |
| App wiring / global JWT guard | `app.module.ts` |
| Bootstrap (prefix, CORS, validation) | `main.ts` |
