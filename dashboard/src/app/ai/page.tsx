'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLE_ROUTES } from '@/lib/authSession';

export default function StandaloneAiPageRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    const base = ROLE_ROUTES[user.role] || '/';
    router.replace(`${base}?tab=ai`);
  }, [isLoading, router, user]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
      <p className="text-sm text-slate-300 font-medium">
        Redirecting to embedded AI Risk Intelligence workspace tab...
      </p>
    </div>
  );
}
