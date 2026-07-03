# Appointments & Scheduling Rules

Appointments live in the **tenant database** (`appointments` table) and link a
`doctor` and a `patient` within the same hospital. All scheduling logic is in
`appointments/appointments.service.ts`.

## Anatomy of an appointment

An appointment occupies a **half-open time slot** `[scheduledAt, scheduledAt + durationMinutes)`:

- `scheduledAt` — `timestamptz` start time (stored/compared in UTC).
- `durationMinutes` — `int`, default **30**.
- `status` — `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`
  (`common/enums/appointment-status.enum.ts`); defaults to `SCHEDULED`.
- `reason` (required), `notes` (optional).

## Scheduling rules (enforced on create **and** update)

These are **hard blocks** — violations throw and the write is rejected.

### 1. No scheduling in the past — `assertNotInPast`
```ts
if (start.getTime() < Date.now())
  throw new BadRequestException('Appointments cannot be scheduled in the past.');
```
Applied on create, and on update whenever the time or duration changes and the
appointment remains `SCHEDULED`.

### 2. No overlap for the same doctor **or** the same patient — `assertNoConflicts`
The core invariant: **a doctor can't be double-booked, and a patient can't be
double-booked.** Both sides are checked independently, each producing a distinct,
human-readable error naming the conflicting slot (in UTC).

Overlap uses the standard half-open interval test — two slots overlap iff:

```
existing.start < new.end   AND   existing.end > new.start
```

In SQL (Postgres `make_interval` derives each row's end from its duration):

```sql
a."scheduledAt" < :end
AND a."scheduledAt" + make_interval(mins => a."durationMinutes") > :start
```

**Back-to-back is allowed.** Because the interval is half-open, an appointment
ending at exactly 09:30 does **not** conflict with one starting at 09:30
(`existing.end > new.start` is `09:30 > 09:30` → false).

### 3. Cancelled / no-show slots are free
The conflict query ignores `CANCELLED` and `NO_SHOW` appointments
(`status NOT IN (...)`) — cancelling frees the slot for rebooking.

### Diagram

```
Doctor's day:      ├──── 09:00–09:30 ────┤├──── 09:30–10:00 ────┤
                          (existing)              back-to-back → OK

New 09:15–09:45:        ├───────┤   ✗ overlaps 09:00–09:30 → ConflictException
New 09:30–10:00:                 ├───────┤   ✓ (touches, no overlap)
Cancelled 10:00–10:30 → slot ignored, a new 10:00 booking succeeds
```

## Create vs. update semantics

**Create** (`create`): validate participants exist → reject past → reject
conflicts → insert as `SCHEDULED`.

**Update** (`update`): merges the patch over the existing row, then guards
**only while the appointment stays `SCHEDULED`**:

- Past-time is re-checked only if `scheduledAt`/`durationMinutes` actually change.
- Conflict check re-runs, **excluding the appointment's own id** (`excludeId`) so
  a record never conflicts with itself.
- Transitioning to `COMPLETED`, `CANCELLED`, or `NO_SHOW` **skips** the time and
  overlap guards — you must be able to complete or cancel historical records
  whose times are in the past.

## Who sees which appointments

`listForUser(ds, user, view)` scopes rows by role
(see [roles-and-permissions.md](roles-and-permissions.md)):

- `HOSPITAL_ADMIN` — all appointments in the tenant.
- `DOCTOR` — only `doctorId = profileId`.
- `PATIENT` — only `patientId = profileId`.

`view` filters and orders the set:

| `view` | Filter | Order |
| --- | --- | --- |
| `upcoming` | `scheduledAt >= now` AND `status = SCHEDULED` | `scheduledAt ASC` |
| `history` | `scheduledAt < now` OR `status != SCHEDULED` | `scheduledAt DESC` |
| `all` | — | `scheduledAt DESC` |

## Front-end guard (defence in depth)

The appointment form sets a `min` on the datetime input to discourage picking a
past time in the UI. This is only a convenience — the **server is authoritative**
and rejects past/overlapping times regardless of the client.

## Endpoints (`/api/appointments`, tenant-scoped)

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| `GET` | `/appointments?view=` | admin/doctor/patient | List (scoped by role + view) |
| `GET` | `/appointments/:id` | admin/doctor/patient | Single appointment |
| `POST` | `/appointments` | `HOSPITAL_ADMIN` | Create (rules enforced) |
| `PATCH` | `/appointments/:id` | `HOSPITAL_ADMIN` | Update / change status |
| `DELETE` | `/appointments/:id` | `HOSPITAL_ADMIN` | Delete |

## A note on time zones

Times are stored and compared as `timestamptz` and conflict messages are
formatted in **UTC** (`formatSlot` → `YYYY-MM-DD HH:mm`). The overlap arithmetic
is timezone-agnostic because every comparison happens on absolute instants.

## Key files

| Concern | File |
| --- | --- |
| All scheduling logic | `appointments/appointments.service.ts` |
| Create/update DTOs | `appointments/dto/appointment.dto.ts` |
| Status enum | `common/enums/appointment-status.enum.ts` |
| Appointment entity (FKs cascade on doctor/patient delete) | `database/tenant/entities/appointment.entity.ts` |
