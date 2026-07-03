import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tenantsApi } from '../../api/tenants.api';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  CalendarIcon,
  DoctorIcon,
  PatientIcon,
} from '../../components/ui/Icons';
import { PageHeader } from '../../components/ui/PageHeader';
import { FullPageLoader } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { formatDate } from '../../lib/format';

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const [inviteSent, setInviteSent] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-stats', id],
    queryFn: () => tenantsApi.stats(id),
  });

  const resendInvite = useMutation({
    mutationFn: () => tenantsApi.resendAdminInvite(id),
    onSuccess: () => setInviteSent(true),
  });

  if (isLoading) return <FullPageLoader />;
  if (!data) {
    return (
      <EmptyState title="Hospital not found" description="It may have been deleted." />
    );
  }

  const { tenant, counts, doctors, patients } = data;

  return (
    <div>
      <Link
        to="/admin/tenants"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary-600"
      >
        ← Back to hospitals
      </Link>

      <PageHeader
        title={tenant.name}
        subtitle={tenant.address ?? 'No address on file'}
        action={
          <div className="flex items-center gap-3">
            {tenant.isActive ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="slate">Inactive</Badge>
            )}
            <button
              className="btn-secondary"
              onClick={() => resendInvite.mutate()}
              disabled={resendInvite.isPending || inviteSent}
            >
              {inviteSent ? 'Invite sent ✓' : 'Resend admin invite'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          label="Appointments"
          value={counts.appointmentCount}
          icon={<CalendarIcon />}
          tone="emerald"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Doctors */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Doctors</h2>
          </div>
          {doctors.length === 0 ? (
            <EmptyState title="No doctors" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {doctors.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={d.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {d.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-400">{d.email}</p>
                  </div>
                  <Badge tone="primary">{d.specialization}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Patients */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Patients</h2>
          </div>
          {patients.length === 0 ? (
            <EmptyState title="No patients" />
          ) : (
            <ul className="divide-y divide-slate-50">
              {patients.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={p.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {p.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-400">{p.email}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {p.dateOfBirth ? formatDate(p.dateOfBirth) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
