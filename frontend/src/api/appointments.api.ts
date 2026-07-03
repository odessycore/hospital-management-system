import { api } from '../lib/api';
import type { Appointment, AppointmentStatus } from '../types';

export type AppointmentView = 'upcoming' | 'history' | 'all';

export interface CreateAppointmentPayload {
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  durationMinutes?: number;
  reason: string;
  notes?: string;
}

export interface UpdateAppointmentPayload {
  doctorId?: string;
  patientId?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  reason?: string;
  notes?: string;
}

export const appointmentsApi = {
  list: (view: AppointmentView = 'all') =>
    api
      .get<Appointment[]>('/appointments', { params: { view } })
      .then((r) => r.data),
  create: (payload: CreateAppointmentPayload) =>
    api.post<Appointment>('/appointments', payload).then((r) => r.data),
  update: (id: string, payload: UpdateAppointmentPayload) =>
    api.patch<Appointment>(`/appointments/${id}`, payload).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/appointments/${id}`).then((r) => r.data),
};
