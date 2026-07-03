import { api } from '../lib/api';
import type { Doctor } from '../types';

export interface CreateDoctorPayload {
  fullName: string;
  email: string;
  phone?: string;
  specialization: string;
  licenseNumber?: string;
}

export type UpdateDoctorPayload = Partial<CreateDoctorPayload> & {
  isActive?: boolean;
};

export const doctorsApi = {
  list: () => api.get<Doctor[]>('/doctors').then((r) => r.data),
  create: (payload: CreateDoctorPayload) =>
    api.post<Doctor>('/doctors', payload).then((r) => r.data),
  update: (id: string, payload: UpdateDoctorPayload) =>
    api.patch<Doctor>(`/doctors/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/doctors/${id}`).then((r) => r.data),
  resendInvite: (id: string) =>
    api.post(`/doctors/${id}/resend-invite`).then((r) => r.data),
};
