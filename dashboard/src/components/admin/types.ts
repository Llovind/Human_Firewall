/**
 * Shared TypeScript types for admin dashboard components.
 * Extracted from admin/page.tsx to enable reuse across role-specific pages.
 */

/* ── API Response Types ────────────────────────────────── */

export interface Incident {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  source: string;
  target: string;
  description: string;
  status: string;
}

export interface ThreatCacheEntry {
  id: string;
  url: string;
  threatType: string;
  score: number;
  source: string;
  action: string;
  detectedAt: string;
}

export interface AISummary {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  threatLevel: string;
  recommendations: string[];
}

export interface BehaviorScore {
  userId: string;
  userName: string;
  email: string;
  division: string;
  score: number;
  risk: string;
  reason: string;
  streak: number;
  rank: number;
  totalPoints: number;
  trainingCompleted: number;
  badges: string[];
}

export interface PolicyDecision {
  id: string;
  timestamp: string;
  threatScore: number;
  behaviorScore: number;
  finalAction: string;
  reason: string;
  url?: string;
}

export interface Stats {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  blockedUrls: number;
  totalEmployees: number;
  avgBehaviorScore: number;
}

export interface GoPhishCampaign {
  id: number;
  name: string;
  status: string;
  created_date: string;
  stats: {
    sent: number;
    opened: number;
    clicked: number;
    submitted_data: number;
  };
}

export interface MockEmail {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface GoPhishResource {
  templates: { id: number; name: string; subject?: string; html?: string; text?: string }[];
  profiles: { id: number; name: string }[];
  pages: { id: number; name: string; html?: string; capture_credentials?: boolean; capture_passwords?: boolean; redirect_url?: string }[];
}

export interface ComplianceSummary {
  compliance_pct: number;
  estimated_savings_idr: number;
  divisi_risk_map: { divisi: string; risk_level: string; avg_points: number }[];
}

export interface AdminLoginEvent {
  id: number;
  email: string;
  division: string;
  login_time: string;
  device: string;
  location: string;
  network: string;
  vpn: boolean;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export interface DivisionLeaderboard {
  divisi: string;
  avg_points: number;
  member_count: number;
}

export interface IndividualLeaderboard {
  rank: number;
  email: string;
  divisi: string;
  points: number;
  badge: string;
  click_count: number;
}

export interface LeaderboardResponse {
  individual: IndividualLeaderboard[];
  by_divisi: DivisionLeaderboard[];
}

/* ── Role Types ────────────────────────────────────────── */

export type AdminRole = 'phishing_admin' | 'soc' | 'grc' | 'ciso';

/** Map each RBAC role to its dashboard route */
export const ROLE_ROUTES: Record<AdminRole, string> = {
  phishing_admin: '/dashboard/phishing-admin',
  soc: '/dashboard/soc',
  grc: '/dashboard/grc',
  ciso: '/dashboard/ciso',
};

/* ── Helper Functions ──────────────────────────────────── */

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}
