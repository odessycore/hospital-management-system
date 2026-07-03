import type { ReactNode } from 'react';
import type { Appointment } from '../types';
import { StatusBadge } from './ui/Badge';
import { formatDateTime } from '../lib/format';

interface Props {
  appointments: Appointment[];
  /** Hide the doctor column (e.g. on a doctor's own schedule). */
  hideDoctor?: boolean;
  /** Hide the patient column (e.g. on a patient's own view). */
  hidePatient?: boolean;
  renderActions?: (appointment: Appointment) => ReactNode;
}

export function AppointmentsTable({
  appointments,
  hideDoctor,
  hidePatient,
  renderActions,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-6 py-3">When</th>
            {!hidePatient && <th className="px-6 py-3">Patient</th>}
            {!hideDoctor && <th className="px-6 py-3">Doctor</th>}
            <th className="px-6 py-3">Reason</th>
            <th className="px-6 py-3">Status</th>
            {renderActions && <th className="px-6 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {appointments.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="font-medium text-slate-800">
                  {formatDateTime(a.scheduledAt)}
                </div>
                <div className="text-xs text-slate-400">
                  {a.durationMinutes} min
                </div>
              </td>
              {!hidePatient && (
                <td className="px-6 py-4 font-medium text-slate-700">
                  {a.patientName}
                </td>
              )}
              {!hideDoctor && (
                <td className="px-6 py-4 text-slate-600">
                  <div>{a.doctorName}</div>
                  <div className="text-xs text-slate-400">
                    {a.doctorSpecialization}
                  </div>
                </td>
              )}
              <td className="max-w-xs px-6 py-4 text-slate-500">
                <div className="truncate">{a.reason}</div>
                {a.notes && (
                  <div className="truncate text-xs text-slate-400">{a.notes}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={a.status} />
              </td>
              {renderActions && (
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">{renderActions(a)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
