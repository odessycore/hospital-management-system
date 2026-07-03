import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  appointmentsApi,
  type AppointmentView,
  type CreateAppointmentPayload,
} from '../../api/appointments.api';
import { doctorsApi } from '../../api/doctors.api';
import { patientsApi } from '../../api/patients.api';
import { AppointmentsTable } from '../../components/AppointmentsTable';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CalendarIcon, EditIcon, PlusIcon, TrashIcon } from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { SectionLoader, Spinner } from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/api';
import { toLocalInputValue } from '../../lib/format';
import type { Appointment, AppointmentStatus } from '../../types';

const STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export function AppointmentsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<AppointmentView>('upcoming');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [toDelete, setToDelete] = useState<Appointment | null>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', view],
    queryFn: () => appointmentsApi.list(view),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      setToDelete(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Schedule and manage appointments between doctors and patients."
        action={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusIcon />
            New appointment
          </button>
        }
      />

      <div className="mb-4">
        <SegmentedTabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'history', label: 'History' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <SectionLoader />
        ) : !appointments || appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title="No appointments"
            description="Schedule an appointment to see it listed here."
            action={
              <button
                className="btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <PlusIcon />
                New appointment
              </button>
            }
          />
        ) : (
          <AppointmentsTable
            appointments={appointments}
            renderActions={(a) => (
              <>
                <button
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary-600"
                  onClick={() => {
                    setEditing(a);
                    setFormOpen(true);
                  }}
                  aria-label="Edit"
                >
                  <EditIcon />
                </button>
                <button
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => setToDelete(a)}
                  aria-label="Delete"
                >
                  <TrashIcon />
                </button>
              </>
            )}
          />
        )}
      </div>

      {formOpen && (
        <AppointmentFormModal
          appointment={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['appointments'] });
            qc.invalidateQueries({ queryKey: ['hospital-stats'] });
            setFormOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete appointment"
        message={`Delete the appointment for ${toDelete?.patientName} with ${toDelete?.doctorName}?`}
        confirmLabel="Delete"
        loading={removeMutation.isPending}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function AppointmentFormModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!appointment;
  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.list,
  });
  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  });

  const defaultWhen = useMemo(() => {
    if (appointment) return toLocalInputValue(new Date(appointment.scheduledAt));
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d);
  }, [appointment]);

  const [form, setForm] = useState({
    doctorId: appointment?.doctorId ?? '',
    patientId: appointment?.patientId ?? '',
    scheduledAt: defaultWhen,
    durationMinutes: appointment?.durationMinutes ?? 30,
    reason: appointment?.reason ?? '',
    notes: appointment?.notes ?? '',
    status: appointment?.status ?? ('SCHEDULED' as AppointmentStatus),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const scheduledAtIso = new Date(form.scheduledAt).toISOString();
      if (isEdit && appointment) {
        return appointmentsApi.update(appointment.id, {
          doctorId: form.doctorId,
          patientId: form.patientId,
          scheduledAt: scheduledAtIso,
          durationMinutes: Number(form.durationMinutes),
          reason: form.reason,
          notes: form.notes || undefined,
          status: form.status,
        });
      }
      const payload: CreateAppointmentPayload = {
        doctorId: form.doctorId,
        patientId: form.patientId,
        scheduledAt: scheduledAtIso,
        durationMinutes: Number(form.durationMinutes),
        reason: form.reason,
        notes: form.notes || undefined,
      };
      return appointmentsApi.create(payload);
    },
    onSuccess: onSaved,
  });

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit appointment' : 'New appointment'}
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
            <label className="label">Patient</label>
            <select
              className="input"
              required
              value={form.patientId}
              onChange={(e) => set('patientId', e.target.value)}
            >
              <option value="">Select a patient…</option>
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Doctor</label>
            <select
              className="input"
              required
              value={form.doctorId}
              onChange={(e) => set('doctorId', e.target.value)}
            >
              <option value="">Select a doctor…</option>
              {doctors?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} — {d.specialization}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date &amp; time</label>
            <input
              className="input"
              type="datetime-local"
              required
              min={isEdit ? undefined : toLocalInputValue(new Date())}
              value={form.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input
              className="input"
              type="number"
              min={5}
              max={480}
              step={5}
              value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', Number(e.target.value))}
            />
          </div>
          {isEdit && (
            <div className="sm:col-span-2">
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  set('status', e.target.value as AppointmentStatus)
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace('_', '-')}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">Reason</label>
            <input
              className="input"
              required
              maxLength={300}
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              placeholder="Routine check-up"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any additional context for this appointment…"
            />
          </div>
        </div>

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
            {isEdit ? 'Save changes' : 'Schedule appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
