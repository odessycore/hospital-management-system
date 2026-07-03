import { api } from '../lib/api';
import type { Tenant, TenantStats, TenantWithCounts } from '../types';

export interface CreateTenantPayload {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  adminFullName: string;
  adminEmail: string;
}

export interface UpdateTenantPayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export const tenantsApi = {
  list: () => api.get<TenantWithCounts[]>('/tenants').then((r) => r.data),
  get: (id: string) => api.get<Tenant>(`/tenants/${id}`).then((r) => r.data),
  stats: (id: string) =>
    api.get<TenantStats>(`/tenants/${id}/stats`).then((r) => r.data),
  create: (payload: CreateTenantPayload) =>
    api.post<Tenant>('/tenants', payload).then((r) => r.data),
  update: (id: string, payload: UpdateTenantPayload) =>
    api.patch<Tenant>(`/tenants/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/tenants/${id}`).then((r) => r.data),
  resendAdminInvite: (id: string) =>
    api.post(`/tenants/${id}/resend-admin-invite`).then((r) => r.data),
};
