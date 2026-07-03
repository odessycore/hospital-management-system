import { api } from '../lib/api';
import type { Patient } from '../types';

export interface CreatePatientPayload {
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
}

export type UpdatePatientPayload = Partial<CreatePatientPayload> & {
  isActive?: boolean;
};

export const patientsApi = {
  list: () => api.get<Patient[]>('/patients').then((r) => r.data),
  create: (payload: CreatePatientPayload) =>
    api.post<Patient>('/patients', payload).then((r) => r.data),
  update: (id: string, payload: UpdatePatientPayload) =>
    api.patch<Patient>(`/patients/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/patients/${id}`).then((r) => r.data),
  resendInvite: (id: string) =>
    api.post(`/patients/${id}/resend-invite`).then((r) => r.data),
};
