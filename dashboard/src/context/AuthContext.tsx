'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export type { AdminRole } from '@/components/admin/types';

/** Set when a signed-in person's session ends on its own (a login lasts one day). The sign-in page explains it once. */
export const SESSION_ENDED_KEY = 'afferent_session_ended';
const SESSION_RECHECK_MS = 60_000;

export interface AuthUser {
  id: number;
  email: string;
  userName: string;
  division: string;
  role: 'employee' | 'phishing_admin' | 'soc' | 'grc' | 'ciso';
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshSession: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  refreshSession: async () => null,
  logout: async () => {},
});

async function fetchCurrentSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hadUser = useRef(false);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    const nextUser = await fetchCurrentSession();
    try {
      setUser(nextUser);
      return nextUser;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const synchronizeSession = () => void fetchCurrentSession().then((nextUser) => {
      if (!active) return;
      if (!nextUser && hadUser.current) {
        try { window.sessionStorage.setItem(SESSION_ENDED_KEY, '1'); } catch { /* storage blocked: the person just lands on sign-in */ }
      }
      hadUser.current = Boolean(nextUser);
      setUser(nextUser);
      setIsLoading(false);
    });

    synchronizeSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') synchronizeSession();
    };
    window.addEventListener('focus', synchronizeSession);
    document.addEventListener('visibilitychange', handleVisibility);
    // A day-long login ends without any click, so look again every minute while the tab is visible.
    const recheck = window.setInterval(() => { if (document.visibilityState === 'visible') synchronizeSession(); }, SESSION_RECHECK_MS);
    return () => {
      active = false;
      window.clearInterval(recheck);
      window.removeEventListener('focus', synchronizeSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const logout = useCallback(async () => {
    hadUser.current = false; // choosing to sign out is not an expired session
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      // Full navigation intentionally discards all previous-role client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/auth');
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      refreshSession,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
