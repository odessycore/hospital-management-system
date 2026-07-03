import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/auth.api';
import { setAuthFailureHandler } from '../lib/api';
import { tokenStorage } from '../lib/tokenStorage';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  completeOAuth: (accessToken: string, refreshToken: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStorage.getUser());
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  // Wire the API layer's "refresh failed" hook to force logout.
  useEffect(() => {
    setAuthFailureHandler(clearSession);
  }, [clearSession]);

  // On load, if we have a token, revalidate the session against the API.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStorage.getAccessToken()) {
        setInitializing(false);
        return;
      }
      try {
        const fresh = await authApi.me();
        if (active) {
          tokenStorage.setUser(fresh);
          setUser(fresh);
        }
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setInitializing(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStorage.setTokens(res.accessToken, res.refreshToken);
    tokenStorage.setUser(res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const completeOAuth = useCallback(
    async (accessToken: string, refreshToken: string) => {
      tokenStorage.setTokens(accessToken, refreshToken);
      const fresh = await authApi.me();
      tokenStorage.setUser(fresh);
      setUser(fresh);
      return fresh;
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, initializing, login, completeOAuth, logout }),
    [user, initializing, login, completeOAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
