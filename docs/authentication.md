# Authentication

Medisys authenticates against the central `auth_users` registry in the **master
database**. Two sign-in methods are supported — **email + password** and
**Google OAuth 2.0** — both of which resolve to the same `auth_users` record and
issue the same token pair. **There is no signup**: unknown emails are always
rejected (see
[account-provisioning-and-invitations.md](account-provisioning-and-invitations.md)
for how accounts come to exist).

## Token model

Every successful login returns a **token pair** (`token.service.ts`):

- **Access token** — a short-lived **JWT** (default TTL `15m`, `config: jwt.accessTtl`),
  signed with `jwt.accessSecret`. It is a bearer token sent on every API request
  as `Authorization: Bearer <token>`. The payload (`JwtPayload`) carries
  everything a request needs to authorise and route without a DB lookup:

  ```
  { sub, email, fullName, role, tenantId, tenantSlug, profileId }
  ```

- **Refresh token** — a long-lived (default 7 days, `config: jwt.refreshTtlDays`),
  opaque, cryptographically-random string (`randomBytes(48)`). Only its
  **SHA-256 hash** is stored in `refresh_tokens`; the raw value is returned to
  the client exactly once.

### Why this split

Short-lived access tokens keep the window small if one leaks; they are
stateless, so the API verifies them without touching the database. The
long-lived refresh token is the only thing stored server-side, so it can be
**revoked** and **rotated** — capabilities a stateless JWT alone can't offer.

## Refresh-token rotation

Refresh tokens are **single-use and rotated on every refresh**
(`TokenService.consumeRefreshToken`):

1. Client calls `POST /auth/refresh` with its raw refresh token.
2. The server looks up the token by hash and rejects it if it is missing,
   already revoked, or expired.
3. The token is marked `revokedAt = now` (consumed).
4. A **fresh** access + refresh pair is issued.

This means a stolen-and-replayed refresh token becomes invalid the moment either
the attacker or the legitimate user next refreshes, and reuse of an already-spent
token fails outright.

- **Logout** (`POST /auth/logout`) revokes the presented refresh token
  (`revokeRefreshToken`, idempotent — unknown tokens are ignored).
- `TokenService.revokeAllForUser(id)` revokes every active token for a user
  (available for "sign out everywhere" / deactivation scenarios).

## Password login

`AuthService.loginWithPassword` (`auth.service.ts`):

1. Look up `auth_users` by normalised (lower-cased, trimmed) email.
2. Reject if the user is missing, **inactive**, or has **no `passwordHash`**
   (i.e. hasn't completed their invitation yet).
3. `bcrypt.compare` the password against the stored hash (bcrypt, 10 rounds).
4. On success, issue a token pair.

Failures return a **generic** `401 Invalid email or password.` — the response
does not reveal whether the email exists.

## Google OAuth 2.0

`GET /auth/google` → Google consent → `GET /auth/google/callback`
(`google.strategy.ts`, `AuthService.loginWithGoogle`):

1. Google returns a verified profile (`email`, `googleId`, `fullName`).
2. The email **must already** map to an active `auth_users` record — otherwise
   `401 No account is registered for this Google email.` (still no signup).
3. On first Google login for a known email, the account's `googleId` is bound so
   subsequent logins are recognised.
4. Issue the same token pair as password login.

An account can have both a `passwordHash` and a `googleId`, or only one of them.

Configure via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
(`config: google`). If unset, the Google routes simply have no working provider;
password login is unaffected.

## Guards

Two guards protect the API (see [roles-and-permissions.md](roles-and-permissions.md)
for the authorisation detail):

- **`JwtAuthGuard`** — registered globally (`APP_GUARD` in `app.module.ts`), so
  **every** route requires a valid JWT unless explicitly marked `@Public()`
  (`common/decorators/public.decorator.ts`). Public routes: `login`, `refresh`,
  `logout`, the Google routes, and the invitation routes.
- **`RolesGuard`** — enforces `@Roles(...)` metadata.

The passport `jwt.strategy.ts` verifies the token and maps the payload onto the
`AuthenticatedUser` object attached as `req.user`.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Email + password login → token pair |
| `POST` | `/api/auth/refresh` | Public | Rotate refresh token → new token pair |
| `POST` | `/api/auth/logout` | Public | Revoke the presented refresh token |
| `GET`  | `/api/auth/me` | JWT | Current user profile (incl. resolved tenant name) |
| `GET`  | `/api/auth/google` | Public | Begin Google OAuth |
| `GET`  | `/api/auth/google/callback` | Public | Google OAuth callback → token pair |

## Key files

| Concern | File |
| --- | --- |
| Login orchestration (password/Google/refresh/logout) | `auth/auth.service.ts` |
| Token signing, refresh rotation & revocation | `auth/token.service.ts` |
| JWT verification strategy | `auth/strategies/jwt.strategy.ts` |
| Google OAuth strategy | `auth/strategies/google.strategy.ts` |
| Global JWT guard + `@Public()` | `common/guards/jwt-auth.guard.ts`, `common/decorators/public.decorator.ts` |
| Token/JWT config | `config/configuration.ts` (`jwt`, `google`) |
