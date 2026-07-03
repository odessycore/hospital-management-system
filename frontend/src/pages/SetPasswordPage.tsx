import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invitationsApi } from '../api/invitations.api';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { CheckIcon } from '../components/ui/Icons';
import { FullPageLoader, Spinner } from '../components/ui/Spinner';
import { getErrorMessage } from '../lib/api';

export function SetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    data: invitation,
    isLoading,
    isError,
    error: describeError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationsApi.describe(token),
    enabled: !!token,
    retry: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await invitationsApi.setPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not set your password.'));
    } finally {
      setSubmitting(false);
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-xl font-bold text-white">
            +
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Medisys
          </span>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );

  if (!token) {
    return (
      <Shell>
        <ErrorBanner message="This link is missing its token. Please use the link from your invitation email." />
      </Shell>
    );
  }

  if (isLoading) return <FullPageLoader label="Checking your invitation…" />;

  if (isError) {
    return (
      <Shell>
        <h1 className="mb-2 text-lg font-semibold text-slate-900">
          Invitation not valid
        </h1>
        <ErrorBanner
          message={getErrorMessage(
            describeError,
            'This invitation link is invalid or has expired.',
          )}
        />
        <button
          className="btn-secondary mt-5 w-full"
          onClick={() => navigate('/login')}
        >
          Go to sign in
        </button>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckIcon />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Password set successfully
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Redirecting you to sign in…
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-slate-900">
        Set your password
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome, <span className="font-medium">{invitation?.fullName}</span>.
        Choose a password for{' '}
        <span className="font-medium">{invitation?.email}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className="label">New password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting && <Spinner className="h-4 w-4" />}
          Set password &amp; continue
        </button>
      </form>
    </Shell>
  );
}
