import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { roleHome } from '../components/ProtectedRoute';

export function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? roleHome(user.role) : '/login';
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <h1 className="text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you’re looking for doesn’t exist or you don’t have access to it.
      </p>
      <Link to={home} className="btn-primary mt-2">
        Go back home
      </Link>
    </div>
  );
}
