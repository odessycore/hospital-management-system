import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { FullPageLoader } from './ui/Spinner';

export function roleHome(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/tenants';
    case 'HOSPITAL_ADMIN':
      return '/hospital';
    case 'DOCTOR':
      return '/doctor';
    case 'PATIENT':
      return '/patient';
    default:
      return '/login';
  }
}

/** Requires authentication; optionally restricts to specific roles. */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullPageLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Outlet />;
}
