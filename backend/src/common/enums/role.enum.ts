export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
}

/** Roles that are scoped to a single tenant (hospital). */
export const TENANT_SCOPED_ROLES: Role[] = [
  Role.HOSPITAL_ADMIN,
  Role.DOCTOR,
  Role.PATIENT,
];
