import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../api/stats.api';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  CalendarIcon,
  ClockIcon,
  DoctorIcon,
  PatientIcon,
} from '../../components/ui/Icons';
import { PageHeader } from '../../components/ui/PageHeader';
import { FullPageLoader } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { formatDateTime } from '../../lib/format';
import type { AppointmentStatus } from '../../types';

const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-primary-500' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-400' },
  NO_SHOW: { label: 'No-show', color: 'bg-amber-500' },
};

export function HospitalDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['hospital-stats'],
    queryFn: statsApi.hospital,
  });

  if (isLoading || !data) return <FullPageLoader />;

  const { counts, statusBreakdown, recentAppointments } = data;
  const totalStatus =
    Object.values(statusBreakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.fullName?.split(' ')[0] ?? 'Administrator'}`}
        subtitle={`Overview of ${user?.tenantName ?? 'your hospital'}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Doctors"
          value={counts.doctorCount}
          icon={<DoctorIcon />}
          tone="blue"
        />
        <StatCard
          label="Patients"
          value={counts.patientCount}
          icon={<PatientIcon />}
          tone="violet"
        />
        <StatCard
          label="Upcoming appointments"
          value={counts.upcomingCount}
          icon={<CalendarIcon />}
          tone="primary"
        />
        <StatCard
          label="Scheduled today"
          value={counts.todayCount}
          icon={<ClockIcon />}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Status breakdown */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800">Appointments by status</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {counts.appointmentCount} total
          </p>
          <div className="mt-5 space-y-4">
            {(Object.keys(STATUS_META) as AppointmentStatus[]).map((status) => {
              const value = statusBreakdown[status] ?? 0;
              const pct = Math.round((value / totalStatus) * 100);
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {STATUS_META[status].label}
                    </span>
                    <span className="font-semibold text-slate-800">{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${STATUS_META[status].color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent appointments */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-800">Recent appointments</h2>
          </div>
          {recentAppointments.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon />}
              title="No appointments yet"
              description="Scheduled appointments will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-6 py-3">Doctor</th>
                    <th className="px-6 py-3">When</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentAppointments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-6 py-3.5 font-medium text-slate-800">
                        {a.patientName}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {a.doctorName}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {formatDateTime(a.scheduledAt)}
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
