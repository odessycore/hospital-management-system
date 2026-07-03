import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute, roleHome } from './components/ProtectedRoute';
import { FullPageLoader } from './components/ui/Spinner';
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TenantsPage } from './pages/superadmin/TenantsPage';
import { TenantDetailPage } from './pages/superadmin/TenantDetailPage';
import { HospitalDashboardPage } from './pages/hospitaladmin/HospitalDashboardPage';
import { DoctorsPage } from './pages/hospitaladmin/DoctorsPage';
import { PatientsPage } from './pages/hospitaladmin/PatientsPage';
import { AppointmentsPage } from './pages/hospitaladmin/AppointmentsPage';
import { DoctorDashboardPage } from './pages/doctor/DoctorDashboardPage';
import { PatientDashboardPage } from './pages/patient/PatientDashboardPage';

function RootRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) return <FullPageLoader />;
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* SUPER_ADMIN */}
      <Route element={<ProtectedRoute roles={['SUPER_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/admin/tenants" element={<TenantsPage />} />
          <Route path="/admin/tenants/:id" element={<TenantDetailPage />} />
        </Route>
      </Route>

      {/* HOSPITAL_ADMIN */}
      <Route element={<ProtectedRoute roles={['HOSPITAL_ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/hospital" element={<HospitalDashboardPage />} />
          <Route path="/hospital/doctors" element={<DoctorsPage />} />
          <Route path="/hospital/patients" element={<PatientsPage />} />
          <Route path="/hospital/appointments" element={<AppointmentsPage />} />
        </Route>
      </Route>

      {/* DOCTOR */}
      <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
        <Route element={<Layout />}>
          <Route path="/doctor" element={<DoctorDashboardPage />} />
        </Route>
      </Route>

      {/* PATIENT */}
      <Route element={<ProtectedRoute roles={['PATIENT']} />}>
        <Route element={<Layout />}>
          <Route path="/patient" element={<PatientDashboardPage />} />
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
