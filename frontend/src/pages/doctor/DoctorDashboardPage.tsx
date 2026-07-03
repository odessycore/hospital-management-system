import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { appointmentsApi } from '../../api/appointments.api';
import { useAuth } from '../../auth/AuthContext';
import { AppointmentsTable } from '../../components/AppointmentsTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { CalendarIcon, CheckIcon, ClockIcon } from '../../components/ui/Icons';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { SectionLoader } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';

export function DoctorDashboardPage() {
  const { user } = useAuth();
  const [view, setView] = useState<'upcoming' | 'history'>('upcoming');

  const upcoming = useQuery({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => appointmentsApi.list('upcoming'),
  });
  const history = useQuery({
    queryKey: ['appointments', 'history'],
    queryFn: () => appointmentsApi.list('history'),
  });

  const active = view === 'upcoming' ? upcoming : history;

  return (
    <div>
      <PageHeader
        title={`Dr. ${user?.fullName?.replace(/^Dr\.?\s+/i, '') ?? ''}`.trim()}
        subtitle={`Your appointments at ${user?.tenantName ?? 'the hospital'}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Upcoming appointments"
          value={upcoming.data?.length ?? 0}
          icon={<CalendarIcon />}
          tone="primary"
        />
        <StatCard
          label="Completed visits"
          value={
            history.data?.filter((a) => a.status === 'COMPLETED').length ?? 0
          }
          icon={<CheckIcon />}
          tone="emerald"
        />
        <StatCard
          label="Past appointments"
          value={history.data?.length ?? 0}
          icon={<ClockIcon />}
          tone="violet"
        />
      </div>

      <div className="mb-4 mt-6">
        <SegmentedTabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'history', label: 'History' },
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        {active.isLoading ? (
          <SectionLoader />
        ) : !active.data || active.data.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title={
              view === 'upcoming'
                ? 'No upcoming appointments'
                : 'No past appointments'
            }
            description="Appointments scheduled for you by the hospital will appear here."
          />
        ) : (
          <AppointmentsTable appointments={active.data} hideDoctor />
        )}
      </div>
    </div>
  );
}
