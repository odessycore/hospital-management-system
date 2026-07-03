import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  doctorsApi,
  type CreateDoctorPayload,
} from '../../api/doctors.api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { DoctorIcon, EditIcon, PlusIcon, TrashIcon } from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionLoader, Spinner } from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/api';
import type { Doctor } from '../../types';

export function DoctorsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Doctor | null>(null);

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.list,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => doctorsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] });
      setToDelete(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Manage the physicians in your hospital."
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add doctor
          </button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <SectionLoader />
        ) : !doctors || doctors.length === 0 ? (
          <EmptyState
            icon={<DoctorIcon />}
            title="No doctors yet"
            description="Add your first physician to begin scheduling appointments."
            action={
              <button className="btn-primary" onClick={() => setCreating(true)}>
                <PlusIcon />
                Add doctor
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Doctor</th>
                  <th className="px-6 py-3">Specialization</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {doctors.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={d.fullName} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {d.fullName}
                          </div>
                          <div className="text-xs text-slate-400">{d.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone="primary">{d.specialization}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {d.phone ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      {d.isActive ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary-600"
                          onClick={() => setEditing(d)}
                          aria-label="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          onClick={() => setToDelete(d)}
                          aria-label="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <DoctorFormModal
          doctor={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['doctors'] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove doctor"
        message={`Remove "${toDelete?.fullName}"? Their login and all associated appointments will be deleted.`}
        confirmLabel="Remove doctor"
        loading={removeMutation.isPending}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'General Surgery',
  'Internal Medicine',
  'Dermatology',
  'Oncology',
  'Radiology',
  'Psychiatry',
];

function DoctorFormModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: Doctor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!doctor;
  const [form, setForm] = useState({
    fullName: doctor?.fullName ?? '',
    email: doctor?.email ?? '',
    phone: doctor?.phone ?? '',
    specialization: doctor?.specialization ?? SPECIALIZATIONS[0],
    licenseNumber: doctor?.licenseNumber ?? '',
    isActive: doctor?.isActive ?? true,
  });
  const [resent, setResent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit && doctor) {
        return doctorsApi.update(doctor.id, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          specialization: form.specialization,
          licenseNumber: form.licenseNumber || undefined,
          isActive: form.isActive,
        });
      }
      const payload: CreateDoctorPayload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        specialization: form.specialization,
        licenseNumber: form.licenseNumber || undefined,
      };
      return doctorsApi.create(payload);
    },
    onSuccess: onSaved,
  });

  const resendMutation = useMutation({
    mutationFn: () => doctorsApi.resendInvite(doctor!.id),
    onSuccess: () => setResent(true),
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit doctor' : 'Add doctor'}
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {mutation.isError && (
          <ErrorBanner message={getErrorMessage(mutation.error)} />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              required
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="Dr. Alan Grant"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="doctor@hospital.io"
            />
          </div>
          <div>
            <label className="label">Specialization</label>
            <select
              className="input"
              value={form.specialization}
              onChange={(e) => set('specialization', e.target.value)}
            >
              {SPECIALIZATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+1 (617) 555-0180"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">License number</label>
            <input
              className="input"
              value={form.licenseNumber}
              onChange={(e) => set('licenseNumber', e.target.value)}
              placeholder="MA-CARD-4471"
            />
          </div>
        </div>

        {!isEdit && (
          <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            An email invitation will be sent to this address so the doctor can set
            their own password and sign in.
          </div>
        )}

        {isEdit && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              Active (can sign in)
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending || resent}
            >
              {resendMutation.isPending && <Spinner className="h-4 w-4" />}
              {resent ? 'Invitation sent ✓' : 'Resend password invite'}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
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
            {isEdit ? 'Save changes' : 'Create doctor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
