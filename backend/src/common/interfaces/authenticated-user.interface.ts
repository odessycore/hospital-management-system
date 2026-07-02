import { Role } from '../enums/role.enum';

/** The identity attached to `req.user` after JWT validation. */
export interface AuthenticatedUser {
  /** auth_users.id in the master database */
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  /** null for SUPER_ADMIN */
  tenantId: string | null;
  /** null for SUPER_ADMIN — the per-tenant database slug */
  tenantSlug: string | null;
  /** doctors.id / patients.id in the tenant DB (DOCTOR / PATIENT only) */
  profileId: string | null;
}

/** Shape of the signed JWT access-token payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  tenantSlug: string | null;
  profileId: string | null;
}
