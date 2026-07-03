import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  tenantsApi,
  type CreateTenantPayload,
} from '../../api/tenants.api';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import {
  DoctorIcon,
  HospitalIcon,
  PatientIcon,
  PlusIcon,
  TrashIcon,
} from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionLoader, Spinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { getErrorMessage } from '../../lib/api';
import type { TenantWithCounts } from '../../types';

export function TenantsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TenantWithCounts | null>(null);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: tenantsApi.list,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      setToDelete(null);
    },
  });

  const totals = (tenants ?? []).reduce(
    (acc, t) => ({
      doctors: acc.doctors + t.doctorCount,
      patients: acc.patients + t.patientCount,
      appointments: acc.appointments + t.appointmentCount,
    }),
    { doctors: 0, patients: 0, appointments: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Hospitals"
        subtitle="Manage tenant hospitals across the platform."
        action={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            Add hospital
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Hospitals"
          value={tenants?.length ?? 0}
          icon={<HospitalIcon />}
          tone="primary"
        />
        <StatCard
          label="Total doctors"
          value={totals.doctors}
          icon={<DoctorIcon />}
          tone="blue"
        />
        <StatCard
          label="Total patients"
          value={totals.patients}
          icon={<PatientIcon />}
          tone="violet"
        />
        <StatCard
          label="Total appointments"
          value={totals.appointments}
          tone="emerald"
        />
      </div>

      <div className="card mt-6 overflow-hidden">
        {isLoading ? (
          <SectionLoader />
        ) : !tenants || tenants.length === 0 ? (
          <EmptyState
            icon={<HospitalIcon />}
            title="No hospitals yet"
            description="Create your first hospital to start onboarding staff and patients."
            action={
              <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                <PlusIcon />
                Add hospital
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Hospital</th>
                  <th className="px-6 py-3">Doctors</th>
                  <th className="px-6 py-3">Patients</th>
                  <th className="px-6 py-3">Appointments</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer transition hover:bg-slate-50"
                    onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.slug} · {t.email ?? 'no contact email'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {t.doctorCount}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {t.patientCount}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {t.appointmentCount}
                    </td>
                    <td className="px-6 py-4">
                      {t.isActive ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(t);
                        }}
                        aria-label={`Delete ${t.name}`}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['tenants'] });
          setCreateOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete hospital"
        message={`Permanently delete "${toDelete?.name}"? This drops its entire database, including all doctors, patients and appointments. This cannot be undone.`}
        confirmLabel="Delete hospital"
        loading={removeMutation.isPending}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const empty: CreateTenantPayload = {
    name: '',
    slug: '',
    address: '',
    phone: '',
    email: '',
    adminFullName: '',
    adminEmail: '',
  };
  const [form, setForm] = useState<CreateTenantPayload>(empty);

  const mutation = useMutation({
    mutationFn: (payload: CreateTenantPayload) => tenantsApi.create(payload),
    onSuccess: () => {
      setForm(empty);
      onCreated();
    },
  });

  const set = (key: keyof CreateTenantPayload, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add hospital"
      description="Provisions a dedicated database and its first administrator."
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
        className="space-y-5"
      >
        {mutation.isError && (
          <ErrorBanner message={getErrorMessage(mutation.error)} />
        )}

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Hospital details
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!form.slug || form.slug === slugify(form.name))
                    set('slug', slugify(e.target.value));
                }}
                placeholder="St. Mary's General Hospital"
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input
                className="input font-mono"
                required
                pattern="[a-z][a-z0-9-]{1,60}"
                title="Lowercase letters, digits and hyphens; must start with a letter."
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                placeholder="st-marys"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="128 Trinity Avenue, Boston, MA"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+1 (617) 555-0142"
              />
            </div>
            <div>
              <label className="label">Contact email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contact@hospital.io"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Hospital administrator
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Full name</label>
              <input
                className="input"
                required
                value={form.adminFullName}
                onChange={(e) => set('adminFullName', e.target.value)}
                placeholder="Margaret Whitfield"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => set('adminEmail', e.target.value)}
                placeholder="admin@hospital.io"
              />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            An email invitation will be sent to the administrator so they can set
            their own password and sign in.
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4" />}
            Create hospital
          </button>
        </div>
      </form>
    </Modal>
  );
}
