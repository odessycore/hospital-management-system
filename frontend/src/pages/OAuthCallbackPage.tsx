import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { roleHome } from '../components/ProtectedRoute';
import { FullPageLoader } from '../components/ui/Spinner';

/** Handles the Google OAuth redirect: tokens arrive in the URL hash fragment. */
export function OAuthCallbackPage() {
  const { completeOAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Sign-in did not complete. Please try again.');
      return;
    }

    completeOAuth(accessToken, refreshToken)
      .then((user) => navigate(roleHome(user.role), { replace: true }))
      .catch(() => setError('Could not establish a session. Please try again.'));
  }, [completeOAuth, navigate]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button className="btn-primary" onClick={() => navigate('/login')}>
          Back to sign in
        </button>
      </div>
    );
  }

  return <FullPageLoader label="Completing sign-in…" />;
}
