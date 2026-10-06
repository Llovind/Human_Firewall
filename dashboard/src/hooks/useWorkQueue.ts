'use client';

import { usePolling } from '@/hooks/usePolling';
import { normalizeSeverity } from '@/components/ui/SeverityBadge';

export type StaffRole = 'soc' | 'grc' | 'ciso' | 'phishing_admin';

export interface WorkQueue {
  /** Access requests waiting for an answer (SOC and GRC). */
  requestsWaiting: number;
  /** Open incidents of any severity. */
  openIncidents: number;
  /** Open incidents that are critical or high. */
  urgentIncidents: number;
  /** When the numbers last arrived, or null before the first answer. */
  updatedAt: number | null;
  /** True when the last refresh failed. */
  failed: boolean;
}

/**
 * What is waiting for a staff member, from the two lists that already exist.
 * One place reads them, so the menu counts, the bell and the "updated" note always agree.
 */
export function useWorkQueue(role: StaffRole): WorkQueue {
  const reads = role === 'soc' || role === 'grc';
  const watches = role === 'soc' || role === 'grc' || role === 'ciso';
  const incidents = usePolling<{ incidents?: { status: string; severity: string }[] }>(watches ? '/api/incident' : '', 30000);
  const requests = usePolling<{ counts?: { open?: number } }>(reads ? '/api/admin/access-requests' : '', 30000);

  const open = (incidents.data?.incidents ?? []).filter(item => item.status !== 'closed');
  const stamps = [watches ? incidents.updatedAt : null, reads ? requests.updatedAt : null].filter((v): v is number => v !== null);
  return {
    requestsWaiting: reads ? requests.data?.counts?.open ?? 0 : 0,
    openIncidents: open.length,
    urgentIncidents: open.filter(item => ['critical', 'high'].includes(normalizeSeverity(item.severity))).length,
    updatedAt: stamps.length ? Math.max(...stamps) : null,
    failed: Boolean((watches && incidents.error) || (reads && requests.error)),
  };
}
