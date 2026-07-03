import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  patientsApi,
  type CreatePatientPayload,
} from '../../api/patients.api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { EditIcon, PatientIcon, PlusIcon, TrashIcon } from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionLoader, Spinner } from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Patient } from '../../types';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

export function PatientsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Patient | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      setToDelete(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Manage the patients registered at your hospital."
        action={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add patient
          </button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <SectionLoader />
        ) : !patients || patients.length === 0 ? (
          <EmptyState
            icon={<PatientIcon />}
            title="No patients yet"
            description="Register your first patient to start booking appointments."
            action={
              <button className="btn-primary" onClick={() => setCreating(true)}>
                <PlusIcon />
                Add patient
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">Gender</th>
                  <th className="px-6 py-3">Blood</th>
                  <th className="px-6 py-3">Date of birth</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.fullName} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {p.fullName}
                          </div>
                          <div className="text-xs text-slate-400">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.gender ?? '—'}</td>
                    <td className="px-6 py-4">
                      {p.bloodGroup ? (
                        <Badge tone="red">{p.bloodGroup}</Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(p.dateOfBirth)}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.phone ?? '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary-600"
                          onClick={() => setEditing(p)}
                          aria-label="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          onClick={() => setToDelete(p)}
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
        <PatientFormModal
          patient={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['patients'] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove patient"
        message={`Remove "${toDelete?.fullName}"? Their login and all associated appointments will be deleted.`}
        confirmLabel="Remove patient"
        loading={removeMutation.isPending}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function PatientFormModal({
  patient,
  onClose,
  onSaved,
}: {
  patient: Patient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!patient;
  const [form, setForm] = useState({
    fullName: patient?.fullName ?? '',
    email: patient?.email ?? '',
    phone: patient?.phone ?? '',
    dateOfBirth: patient?.dateOfBirth ?? '',
    gender: patient?.gender ?? '',
    bloodGroup: patient?.bloodGroup ?? '',
    address: patient?.address ?? '',
    isActive: patient?.isActive ?? true,
  });
  const [resent, setResent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const shared = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        address: form.address || undefined,
      };
      if (isEdit && patient) {
        return patientsApi.update(patient.id, {
          ...shared,
          isActive: form.isActive,
        });
      }
      return patientsApi.create(shared as CreatePatientPayload);
    },
    onSuccess: onSaved,
  });

  const resendMutation = useMutation({
    mutationFn: () => patientsApi.resendInvite(patient!.id),
    onSuccess: () => setResent(true),
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit patient' : 'Add patient'}
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
              placeholder="John Hammond"
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
              placeholder="patient@example.com"
            />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input
              className="input"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+1 (617) 555-0201"
            />
          </div>
          <div>
            <label className="label">Gender</label>
            <select
              className="input"
              value={form.gender}
              onChange={(e) => set('gender', e.target.value)}
            >
              <option value="">Not specified</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Blood group</label>
            <select
              className="input"
              value={form.bloodGroup}
              onChange={(e) => set('bloodGroup', e.target.value)}
            >
              <option value="">Not specified</option>
              {BLOOD_GROUPS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="9 Cranborne Chase, Boston, MA"
            />
          </div>
        </div>

        {!isEdit && (
          <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            An email invitation will be sent to this address so the patient can set
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
            {isEdit ? 'Save changes' : 'Create patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
