import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { Avatar } from './ui/Avatar';
import {
  CalendarIcon,
  DoctorIcon,
  HospitalIcon,
  LogoutIcon,
  MenuIcon,
  PatientIcon,
  CloseIcon,
  DashboardIcon,
} from './ui/Icons';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Platform Administrator',
  HOSPITAL_ADMIN: 'Hospital Administrator',
  DOCTOR: 'Physician',
  PATIENT: 'Patient',
};

function navForRole(role: Role): NavItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { to: '/admin/tenants', label: 'Hospitals', icon: <HospitalIcon /> },
      ];
    case 'HOSPITAL_ADMIN':
      return [
        { to: '/hospital', label: 'Dashboard', icon: <DashboardIcon />, end: true },
        { to: '/hospital/doctors', label: 'Doctors', icon: <DoctorIcon /> },
        { to: '/hospital/patients', label: 'Patients', icon: <PatientIcon /> },
        { to: '/hospital/appointments', label: 'Appointments', icon: <CalendarIcon /> },
      ];
    case 'DOCTOR':
      return [{ to: '/doctor', label: 'My Schedule', icon: <CalendarIcon />, end: true }];
    case 'PATIENT':
      return [{ to: '/patient', label: 'My Appointments', icon: <CalendarIcon />, end: true }];
    default:
      return [];
  }
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
        <span className="text-lg font-bold">+</span>
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-slate-900">
          Medisys
        </p>
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Care Platform
        </p>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  const items = navForRole(user.role);
  const scopeName =
    user.role === 'SUPER_ADMIN'
      ? 'Platform Console'
      : user.tenantName ?? 'Hospital';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Brand />
        <button
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {user.role === 'SUPER_ADMIN' ? 'Workspace' : 'Hospital'}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
          {scopeName}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user.fullName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {user.fullName}
            </p>
            <p className="truncate text-xs text-slate-400">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogoutIcon />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <Brand />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
