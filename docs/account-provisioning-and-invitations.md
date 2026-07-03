# Account Provisioning & the Set-Password Invitation Flow

**There is no self-signup.** Every account is provisioned by an administrator,
and the user then sets their own password through a single-use, emailed
invitation link. This document covers how accounts are created across the two
databases and how the invitation flow works end to end.

## Who provisions whom

| New account | Created by | Where |
| --- | --- | --- |
| `HOSPITAL_ADMIN` | `SUPER_ADMIN` (when creating the hospital) | `TenantsService.create` |
| `DOCTOR` | `HOSPITAL_ADMIN` | `DoctorsService.create` |
| `PATIENT` | `HOSPITAL_ADMIN` | `PatientsService.create` |
| `SUPER_ADMIN` | Seed script / manual | `seed/seed.ts` |

## A write that spans two databases

Creating a doctor/patient touches **both** databases and must keep them
consistent (there are no cross-database foreign keys —
see [data-model.md](data-model.md)):

1. **Master DB** — `AccountsService.createLogin` inserts an `auth_users` row.
   It is **password-less** (`passwordHash = null`), so the account exists and is
   `isActive` but **cannot log in with a password yet**.
2. **Tenant DB** — the profile row (`doctors` / `patients`) is inserted, carrying
   `authUserId` back to the master login.
3. **Link back** — `AccountsService.linkProfile` sets `auth_users.profileId` to
   the new profile row's id.
4. **Invite** — `InvitationsService.sendInvite` issues a token and emails the
   set-password link.

If step 2 fails, the code **rolls back** the master login it just created
(`accounts.deleteLogin`) so no orphaned login is left behind. Tenant creation
applies the same pattern at a larger scale: if provisioning the database or the
admin fails, the master `tenants` row is deleted and the tenant DB dropped
(`TenantsService.create`).

```
HOSPITAL_ADMIN "Add doctor"
      │
      ▼
createLogin (master, passwordHash=null) ──▶ save doctor (tenant) ──▶ linkProfile ──▶ sendInvite
      │                                          │ fails?
      └──────────── deleteLogin (rollback) ◀─────┘
```

## The invitation

`InvitationsService` (`invitations/invitations.service.ts`) + `Invitation`
entity (master DB).

### Issuing — `sendInvite(authUser)`
1. **Invalidate** any of the user's outstanding unused invitations
   (`usedAt = now`) — only the newest link is ever valid (rotation / resend).
2. Generate a random raw token: `randomBytes(32).toString('hex')`.
3. Store **only the SHA-256 hash** (`tokenHash`), plus `email`, `authUserId`,
   and `expiresAt = now + invite.ttlHours` (default **72h**, `INVITE_TTL_HOURS`).
4. Email a link to `${frontendUrl}/set-password?token=<rawToken>` via
   `MailerService`. The raw token appears only in the email — never in the DB.

### Viewing the screen — `GET /auth/invitation/:token` → `describe`
Public. Validates the token and returns `{ email, fullName, valid }` so the
set-password page can greet the user. **Does not consume** the token.

### Completing — `POST /auth/set-password` → `setPassword`
Public. Body: `{ token, password }` (`SetPasswordDto`: token ≥ 16 chars,
password ≥ 8 chars). It:
1. Re-validates the token.
2. `bcrypt`-hashes the new password onto `auth_users.passwordHash` and ensures
   `isActive = true`.
3. Marks the invitation `usedAt = now` (single-use).

After this the user can log in normally (see [authentication.md](authentication.md)).

### Validation — `findValid(rawToken)`
Every entry point routes through one guard that rejects with a specific message:

| Condition | Result |
| --- | --- |
| No invitation matches the hash | `404 This invitation link is invalid.` |
| `usedAt` is set | `400 This invitation link has already been used.` |
| `expiresAt` in the past | `400 This invitation link has expired…` |

## Resend

Because `sendInvite` invalidates prior invitations first, "resend" is just
"issue a fresh one" — old links stop working immediately.

| Who | Endpoint | Handler |
| --- | --- | --- |
| Hospital admin → doctor | `POST /doctors/:id/resend-invite` | `DoctorsService.resendInvite` |
| Hospital admin → patient | `POST /patients/:id/resend-invite` | `PatientsService.resendInvite` |
| Super admin → hospital admin | `POST /tenants/:id/resend-admin-invite` | `TenantsService.resendAdminInvite` |

Doctor/patient resend resolves the profile → `authUserId` →
`sendInviteByAuthUserId`. The tenant version resolves the hospital's primary
admin (`AccountsService.findPrimaryAdmin`). The frontend surfaces these as
"Resend password invite" buttons on the doctor, patient, and tenant-detail pages.

## Email delivery — `MailerService`

`mailer/mailer.service.ts` wraps nodemailer:

- If **`MAIL_HOST` is set**, it sends real SMTP mail.
- If **not**, it falls back to a JSON transport and **logs the full message
  (including the invite link) to the server console** — so the flow is fully
  testable locally without an SMTP server. Watch the backend log for the
  `✉️ DEV EMAIL` banner and copy the link.

## Security properties

- Raw tokens are **never stored** — only SHA-256 hashes, so a DB leak does not
  expose usable links.
- Tokens are **single-use** and **time-boxed** (72h default).
- Issuing a new invite **invalidates all previous ones** for that user.
- Newly-provisioned logins have **no password** and cannot be signed into until
  the invite is completed.

## Security notes / possible hardening

- The same invitation mechanism can back a "reset password" flow (the
  `Invitation` entity comment anticipates this); there is currently no
  self-service "forgot password" endpoint — an admin resend is the reset path.
- `set-password` does not currently revoke existing refresh tokens; if you add a
  true password-reset path, consider calling `TokenService.revokeAllForUser`.

## Key files

| Concern | File |
| --- | --- |
| Invitation issuing / validation / consumption | `invitations/invitations.service.ts` |
| Public invitation endpoints | `invitations/invitations.controller.ts` |
| Set-password DTO | `invitations/dto/set-password.dto.ts` |
| Master login records | `accounts/accounts.service.ts` |
| Doctor/patient provisioning | `staff/doctors.service.ts`, `staff/patients.service.ts` |
| Hospital + admin provisioning | `tenants/tenants.service.ts` |
| Email transport | `mailer/mailer.service.ts` |
| Invitation entity | `database/master/entities/invitation.entity.ts` |
