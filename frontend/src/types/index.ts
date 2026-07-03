export type Role = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'PATIENT';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName?: string | null;
  profileId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantWithCounts extends Tenant {
  doctorCount: number;
  patientCount: number;
  appointmentCount: number;
}

export interface Doctor {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  licenseNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string;
  notes: string | null;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  patientId: string;
  patientName: string;
  createdAt: string;
}

export interface TenantStats {
  tenant: Tenant;
  counts: {
    doctorCount: number;
    patientCount: number;
    appointmentCount: number;
  };
  doctors: Doctor[];
  patients: Patient[];
}

export interface HospitalStats {
  counts: {
    doctorCount: number;
    patientCount: number;
    appointmentCount: number;
    upcomingCount: number;
    todayCount: number;
  };
  statusBreakdown: Record<AppointmentStatus, number>;
  recentAppointments: Array<{
    id: string;
    scheduledAt: string;
    status: AppointmentStatus;
    reason: string;
    doctorName: string;
    patientName: string;
  }>;
}
