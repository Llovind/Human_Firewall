'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StandaloneAiPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Determine active role from localStorage or default to 'soc'
    let role = 'soc';
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('hfl_admin_role');
      if (storedRole && ['soc', 'ciso', 'grc', 'phishing_admin'].includes(storedRole)) {
        role = storedRole;
      }
    }
    router.replace(`/dashboard/${role}?tab=ai`);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
      <p className="text-sm text-slate-300 font-medium">
        Redirecting to embedded AI Risk Intelligence workspace tab...
      </p>
    </div>
  );
}
