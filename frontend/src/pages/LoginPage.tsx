import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuth } from '../auth/AuthContext';
import { GoogleIcon, HospitalIcon } from '../components/ui/Icons';
import { Spinner } from '../components/ui/Spinner';
import { getErrorMessage } from '../lib/api';
import { roleHome } from '../components/ProtectedRoute';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'superadmin@hospital.io' },
  { label: 'Hospital Admin', email: 'admin@stmarys.io' },
  { label: 'Doctor', email: 'alan.grant@stmarys.io' },
  { label: 'Patient', email: 'john.hammond@example.com' },
];

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'google_account_not_found'
      ? 'No account is registered for that Google email. Contact your administrator.'
      : null,
  );

  if (user) {
    navigate(roleHome(user.role), { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const signedIn = await login(email.trim(), password);
      navigate(roleHome(signedIn.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left: form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-xl font-bold text-white">
              +
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">
                Medisys
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Care Platform
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to access your dashboard.
          </p>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@hospital.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting && <Spinner className="h-4 w-4" />}
              Sign in
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <a href={authApi.googleUrl()} className="btn-secondary w-full">
            <GoogleIcon />
            Continue with Google
          </a>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Demo accounts · password{' '}
              <span className="font-mono normal-case text-slate-700">
                Password123!
              </span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('Password123!');
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-xs transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="block font-semibold text-slate-700">
                    {acc.label}
                  </span>
                  <span className="block truncate text-slate-400">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-teal-500 lg:flex lg:w-1/2">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-16 top-16 h-72 w-72 rounded-full border-[40px] border-white" />
          <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full border-[24px] border-white" />
        </div>
        <div className="relative flex flex-col justify-center px-16 text-white">
          <HospitalIcon className="h-14 w-14" width={56} height={56} />
          <h2 className="mt-6 text-3xl font-bold leading-tight">
            Unified care management for modern hospitals.
          </h2>
          <p className="mt-4 max-w-md text-primary-50/90">
            Securely manage doctors, patients and appointments across every
            hospital — each with its own isolated, private database.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-primary-50/90">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                ✓
              </span>
              Multi-tenant, database-per-hospital isolation
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                ✓
              </span>
              Role-based access for every team member
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                ✓
              </span>
              Enterprise-grade authentication
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
