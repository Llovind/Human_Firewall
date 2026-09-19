'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type { AdminRole } from '@/components/admin/types';

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
      setUser(nextUser);
      setIsLoading(false);
    });

    synchronizeSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') synchronizeSession();
    };
    window.addEventListener('focus', synchronizeSession);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', synchronizeSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
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
