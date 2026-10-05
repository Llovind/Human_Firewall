/**
 * Fake data for mock mode. Shapes match what the browser receives from the
 * dashboard's /api/* routes (see src/components/admin/types.ts and the pages).
 * All names, addresses and domains are invented.
 */
import type { MockRole } from './config';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/* ── People ─────────────────────────────────────────────── */

export const MOCK_USERS: Record<MockRole, { id: number; email: string; userName: string; division: string; role: MockRole }> = {
  employee: { id: 1, email: 'sinta.maharani@afferent.local', userName: 'Sinta Maharani', division: 'Finance', role: 'employee' },
  phishing_admin: { id: 2, email: 'dimas.anggara@afferent.local', userName: 'Dimas Anggara', division: 'Security', role: 'phishing_admin' },
  soc: { id: 3, email: 'rafi.pratama@afferent.local', userName: 'Rafi Pratama', division: 'Security', role: 'soc' },
  grc: { id: 4, email: 'laras.wulandari@afferent.local', userName: 'Laras Wulandari', division: 'Compliance', role: 'grc' },
  ciso: { id: 5, email: 'bayu.santoso@afferent.local', userName: 'Bayu Santoso', division: 'Executive', role: 'ciso' },
};

const DIVISIONS = ['Finance', 'Engineering', 'Human Resources', 'Marketing', 'Operations'];

type Person = { email: string; divisi: string; points: number; clicks: number; trained: number; skipped: number; reports: number; streak: number; spot: number };
const PEOPLE: Person[] = [
  { email: 'sinta.maharani@afferent.local', divisi: 'Finance', points: 142, clicks: 1, trained: 4, skipped: 0, reports: 3, streak: 6, spot: 2 },
  { email: 'andi.kurniawan@afferent.local', divisi: 'Engineering', points: 176, clicks: 0, trained: 6, skipped: 0, reports: 5, streak: 12, spot: 4 },
  { email: 'maya.lestari@afferent.local', divisi: 'Marketing', points: 118, clicks: 2, trained: 3, skipped: 1, reports: 1, streak: 3, spot: 1 },
  { email: 'budi.hartono@afferent.local', divisi: 'Operations', points: 94, clicks: 3, trained: 2, skipped: 1, reports: 0, streak: 1, spot: 0 },
  { email: 'citra.dewi@afferent.local', divisi: 'Human Resources', points: 131, clicks: 1, trained: 4, skipped: 0, reports: 2, streak: 5, spot: 1 },
  { email: 'eko.prasetyo@afferent.local', divisi: 'Finance', points: 52, clicks: 5, trained: 1, skipped: 3, reports: 0, streak: 0, spot: 0 },
  { email: 'fitri.rahayu@afferent.local', divisi: 'Engineering', points: 158, clicks: 0, trained: 5, skipped: 0, reports: 4, streak: 9, spot: 3 },
  { email: 'gilang.permana@afferent.local', divisi: 'Operations', points: 41, clicks: 6, trained: 0, skipped: 4, reports: 0, streak: 0, spot: 0 },
  { email: 'hana.puspita@afferent.local', divisi: 'Marketing', points: 87, clicks: 3, trained: 2, skipped: 2, reports: 1, streak: 2, spot: 0 },
  { email: 'indra.wijaya@afferent.local', divisi: 'Human Resources', points: 109, clicks: 2, trained: 3, skipped: 1, reports: 1, streak: 4, spot: 1 },
  { email: 'joko.susilo@afferent.local', divisi: 'Finance', points: 66, clicks: 4, trained: 1, skipped: 2, reports: 0, streak: 0, spot: 0 },
  { email: 'kartika.sari@afferent.local', divisi: 'Engineering', points: 189, clicks: 0, trained: 7, skipped: 0, reports: 8, streak: 21, spot: 5 },
];

const badgeFor = (points: number) => (points >= 130 ? 'Sentinel' : points >= 60 ? 'Guardian' : 'Vulnerable');
const nameFor = (email: string) => email.split('@')[0].split('.').map(p => p[0].toUpperCase() + p.slice(1)).join(' ');
const sorted = [...PEOPLE].sort((a, b) => b.points - a.points);

export const leaderboard = () => ({
  individual: sorted.map((p, i) => ({
    email: p.email, divisi: p.divisi, points: p.points, badge: badgeFor(p.points), click_count: p.clicks,
    viewed_training_count: p.trained, skipped_training_count: p.skipped, reports_count_malicious: p.reports,
    daily_streak: p.streak, last_clicked: p.clicks ? ago((i + 2) * DAY) : null, updated_at: ago((i + 1) * HOUR),
    spot_fake_wins: p.spot, rank: i + 1, streak_weeks: Math.min(p.streak, 8),
  })),
  by_divisi: DIVISIONS.map(d => {
    const members = PEOPLE.filter(p => p.divisi === d);
    return { divisi: d, avg_points: Math.round(members.reduce((s, p) => s + p.points, 0) / members.length * 10) / 10, member_count: members.length };
  }).sort((a, b) => b.avg_points - a.avg_points),
});

/** Same data after the /api/behavior route reshapes it for the dashboards. */
export const behavior = (email?: string | null) => {
  const lb = leaderboard();
  const scores = lb.individual.map(u => {
    const score = Math.max(0, Math.min(100, Math.round(u.points / 2)));
    const badges: string[] = [];
    if (u.badge !== 'None') badges.push(u.badge);
    if (u.streak_weeks >= 4) badges.push('4-Week Streak');
    if (u.reports_count_malicious > 0) badges.push('Threat Reporter');
    if (u.spot_fake_wins > 0) badges.push('Spotter Master');
    if (u.daily_streak >= 5) badges.push('Quiz Champion');
    return {
      userId: u.email, userName: nameFor(u.email), email: u.email, division: u.divisi, score,
      risk: u.points >= 130 ? 'low' : u.points >= 60 ? 'medium' : 'high',
      reason: score >= 70 ? 'Konsisten menjaga kepatuhan' : score >= 40 ? 'Perlu meningkatkan kepatuhan' : 'Sering terjebak phishing simulasi',
      lastUpdated: u.updated_at, streak: u.streak_weeks, dailyStreak: u.daily_streak, rank: u.rank,
      totalPoints: u.points, trainingCompleted: u.viewed_training_count, badges,
    };
  });
  return {
    scores: email ? scores.filter(s => s.email === email) : scores,
    by_divisi: lb.by_divisi.map(d => ({ division: d.divisi, avg: d.avg_points, memberCount: d.member_count })),
  };
};

export const employees = () => ({
  employees: sorted.map(p => ({
    email: p.email, divisi: p.divisi, click_count: p.clicks, viewed_training_count: p.trained,
    skipped_training_count: p.skipped, points: p.points, badge: badgeFor(p.points),
    reports_count_malicious: p.reports, reports_count_total: p.reports + 1, daily_streak: p.streak,
    is_active: p.email === 'gilang.permana@afferent.local' ? 0 : 1, account_id: 100 + PEOPLE.indexOf(p),
    role: 'employee', last_login_at: ago(PEOPLE.indexOf(p) * 5 * HOUR), has_account: 1,
  })),
});

export const divisions = () => ({
  divisions: DIVISIONS.map(name => ({ name, employee_count: PEOPLE.filter(p => p.divisi === name).length })),
});

/* ── Employee home ──────────────────────────────────────── */

export const quizToday = () => ({
  completed_today: false, id: 17,
  question_text: 'You receive an email from "IT Support" asking you to confirm your password within 30 minutes. What should you do?',
  options: ['Reply with your password so IT can verify it', 'Click the link and sign in quickly', 'Do not respond; report the email to the security team', 'Forward it to coworkers to warn them'],
  correct_answer_index: 2, category: 'Phishing', difficulty: 'easy',
});
export const quizDone = () => ({ completed_today: true, daily_streak: 6, message: 'Anda sudah menyelesaikan kuis hari ini — Streak terjaga!' });
export const quizComplete = (correct: boolean) => ({
  status: 'completed', correct, points_awarded: correct ? 10 : 0, daily_streak: correct ? 7 : 0,
  last_quiz_completed_at: new Date().toISOString().slice(0, 10), revive_available: !correct, revives_remaining: correct ? 0 : 1,
  streak_before_break: correct ? 0 : 6,
});

export const userActivity = () => ({
  activities: [
    { event_type: 'report_malicious', tier_assigned: 'malicious', campaign_id: 'http://secure-payroll-update.example', created_at: ago(35 * MIN) },
    { event_type: 'daily_quiz_completed', tier_assigned: 'quiz', campaign_id: null, created_at: ago(5 * HOUR) },
    { event_type: 'spot_the_fake_correct', tier_assigned: 'Guardian', campaign_id: null, created_at: ago(1 * DAY) },
    { event_type: 'viewed_training', tier_assigned: 'Guardian', campaign_id: 'Q3 Invoice Lure', created_at: ago(2 * DAY) },
    { event_type: 'clicked_link', tier_assigned: 'Guardian', campaign_id: 'Q3 Invoice Lure', created_at: ago(2 * DAY + HOUR) },
    { event_type: 'report_safe', tier_assigned: 'clean', campaign_id: 'https://news.example.org', created_at: ago(4 * DAY) },
  ],
  count: 6,
});

export const eligibility = () => ({ eligible: true, points: 142, behavior_score: 71 });
export const reportsSummary = (email: string) => ({
  email, reports_count_malicious: 3, reports_count_total: 5, daily_streak: 6, last_quiz_completed_at: ago(5 * HOUR).slice(0, 10),
  badges: [
    { id: 'sentinel_troops', label: 'Sentinel Troops', threshold: 1, achieved: true },
    { id: 'front_line_defender', label: 'Front Line Defender', threshold: 3, achieved: true },
    { id: 'the_front_man', label: 'The Front Man', threshold: 5, achieved: false },
    { id: 'cyber_shield_elite', label: 'Cyber Shield Elite', threshold: 10, achieved: false },
  ],
  next_badge: { id: 'the_front_man', threshold: 5, remaining: 2 },
});

/* ── URL / file scanning ────────────────────────────────── */

const evidence = (verdict: string, vt: number) => ({
  analysisVersion: 2, providers: ['virustotal', 'urlscan'], verdict, severity: verdict === 'malicious' ? 'high' : 'low', confidence: verdict === 'malicious' ? 92 : 80,
  recommendation: 'Review',
  providerStatus: { virustotal: { state: 'ready', statusCode: 200 }, urlscan: { state: 'ready', statusCode: 200 } },
  evidence: { virustotal: { verdict, vt_score: vt }, urlscan: { verdict } },
});
export const urlScan = (url: string) => {
  const bad = /login|verify|secure|update|payroll/i.test(url);
  return { success: true, data: evidence(bad ? 'malicious' : 'clean', bad ? 14 : 0) };
};
export const urlReports = () => ({
  reports: [
    { id: 'rep-1003', email: MOCK_USERS.employee.email, url: 'http://secure-payroll-update.example/login', description: 'Looks like our payroll portal but the address is odd.', verdict: 'malicious', status: 'under review', created_at: ago(35 * MIN), analysis: evidence('malicious', 14) },
    { id: 'rep-1002', email: MOCK_USERS.employee.email, url: 'https://news.example.org/article', description: '', verdict: 'clean', status: 'submitted', created_at: ago(4 * DAY), analysis: evidence('clean', 0) },
  ],
});
export const fileScans = () => ({
  maxBytes: 10 * 1024 * 1024,
  scans: [
    { id: 'file-3', file_name: 'invoice-october.pdf.exe', file_sha256: 'a3f1c9d0e2b44f6a8d7c1e5b9a0f2c34d6e8b1a7c9d0e3f5a2b4c6d8e0f1a2b3', file_size: 482_113, verdict: 'malicious', status: 'completed', created_at: ago(2 * HOUR), analysis: evidence('malicious', 31) },
    { id: 'file-2', file_name: 'team-photo.png', file_sha256: 'b7e2d1c0a9f8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6b5a4938271605f4', file_size: 1_204_551, verdict: 'clean', status: 'completed', created_at: ago(1 * DAY), analysis: evidence('clean', 0) },
    { id: 'file-1', file_name: 'budget-draft.xlsx', file_sha256: 'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f50', file_size: 88_240, verdict: 'unknown', status: 'pending', created_at: ago(1 * MIN), analysis: { verdict: 'unknown', providerStatus: { virustotal: { state: 'queued', statusCode: 0 } } } },
  ],
});
export const fileScanAccepted = (name: string, size: number) => ({
  success: true, duplicate: false,
  scan: { id: 'file-new', file_name: name, file_sha256: 'd'.repeat(64), file_size: size, verdict: 'unknown', status: 'pending', created_at: new Date().toISOString(), analysis: { verdict: 'unknown', providerStatus: { virustotal: { state: 'queued', statusCode: 0 } } } },
});
export const reportAccepted = (url: string) => ({
  success: true, duplicate: false,
  report: { id: 'rep-new', email: MOCK_USERS.employee.email, url, description: '', verdict: 'unknown', status: 'submitted', created_at: new Date().toISOString(), analysis: evidence('unknown', 0) },
  reward: { awarded: true, points_awarded: 15, daily_count: 1, daily_cap: 5 },
});

/* ── Access requests (employee asks to open a blocked site) ── */

const accessRequestRows = () => ([
  { id: '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e01', email: MOCK_USERS.employee.email, domain: 'supplier-portal.example', reason: 'This is my supplier payment portal and I need it to pay an invoice due today.', status: 'open', decision_note: null, decided_by: null, decided_at: null, created_at: ago(40 * MIN) },
  { id: '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e02', email: 'maya.lestari@afferent.local', domain: 'partner-docs.example', reason: 'Our marketing partner shares campaign files through this site.', status: 'open', decision_note: null, decided_by: null, decided_at: null, created_at: ago(3 * HOUR) },
  { id: '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e03', email: 'andi.kurniawan@afferent.local', domain: 'cdn-fonts.example', reason: 'Fonts for the new landing page do not load.', status: 'allowed', decision_note: 'Checked: well-known font host, no abuse reports.', decided_by: MOCK_USERS.soc.email, decided_at: ago(20 * HOUR), created_at: ago(26 * HOUR) },
  { id: '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e04', email: 'eko.prasetyo@afferent.local', domain: 'secure-payroll-update.example', reason: 'I received a link and want to look at it.', status: 'denied', decision_note: 'Confirmed phishing site. Please report such links instead of opening them.', decided_by: MOCK_USERS.soc.email, decided_at: ago(30 * HOUR), created_at: ago(31 * HOUR) },
]);
const employeeView = (row: ReturnType<typeof accessRequestRows>[number]) => ({
  id: row.id, domain: row.domain, reason: row.reason, status: row.status, decision_note: row.decision_note, decided_at: row.decided_at, created_at: row.created_at,
});
export const accessRequestsMine = () => ({ requests: [
  employeeView(accessRequestRows()[0]),
  { ...employeeView(accessRequestRows()[3]), domain: 'old-invoices.example', reason: 'Needed an old invoice archive.', created_at: ago(5 * 24 * HOUR), decided_at: ago(4 * 24 * HOUR) },
] });
export const accessRequestsStaff = () => {
  const rows = accessRequestRows();
  return { requests: rows, counts: { open: rows.filter(r => r.status === 'open').length, allowed: rows.filter(r => r.status === 'allowed').length, denied: rows.filter(r => r.status === 'denied').length } };
};
export const accessRequestAccepted = (domain: string, reason: string) => ({
  success: true, duplicate: false,
  request: { id: '7d1b5c22-4a0e-4c19-9d52-0a1b2c3d4e99', domain, reason, status: 'open', decision_note: null, decided_at: null, created_at: new Date().toISOString() },
});
export const accessRequestDecided = (id: string, decision: string, note: string) => ({
  success: true,
  request: { ...(accessRequestRows().find(r => r.id === id) ?? accessRequestRows()[0]), status: decision === 'allow' ? 'allowed' : 'denied', decision_note: note, decided_by: MOCK_USERS.soc.email, decided_at: new Date().toISOString() },
});

/* ── SOC / CISO / GRC data ──────────────────────────────── */

export const incidents = (closedIds = '', owners: Record<string, string | null> = {}) => {
  const closedNow = new Set(closedIds.split(',').filter(Boolean));
  const rows = [
    ['INC-2041', 'phishing_url', 'critical', 'Finance', 'http://secure-payroll-update.example/login', 'VirusTotal: 14 engines flagged this URL', 'open', 35 * MIN],
    ['INC-2040', 'threat_report', 'high', 'Operations', 'invoice-october.pdf.exe', 'File flagged as trojan by 31 engines', 'open', 2 * HOUR],
    ['INC-2039', 'phishing_url', 'medium', 'Marketing', 'http://promo-giftcards.example/claim', 'urlscan: suspicious redirect chain', 'open', 7 * HOUR],
    ['INC-2038', 'phishing_url', 'high', 'Engineering', 'http://git-hub-login.example/session', 'Look-alike of a code hosting login page', 'closed', 1 * DAY],
    ['INC-2037', 'threat_report', 'low', 'Human Resources', 'N/A', 'Report submitted via AFFERENT', 'closed', 3 * DAY],
  ] as const;
  const list = rows.map(([id, type, severity, source, target, description, status, age]) => ({ id, timestamp: ago(age), type, severity, source, target, description, status: closedNow.has(id) ? 'closed' : status, assignee: id in owners ? owners[id] : (id === 'INC-2040' ? MOCK_USERS.soc.email : null) }));
  return {
    incidents: list,
    stats: {
      totalIncidents: list.length, openIncidents: list.filter(i => i.status !== 'closed').length,
      resolvedIncidents: list.filter(i => i.status === 'closed').length,
      highSeverity: list.filter(i => ['high', 'critical'].includes(i.severity) && i.status !== 'closed').length,
      activeThreats: list.filter(i => i.status !== 'closed').length,
    },
  };
};

export const incidentEvents = (id: string, extra: unknown[] = []) => {
  const seeded: Record<string, unknown[]> = {
    'INC-2038': [{ id: 3, ticket_id: 'INC-2038', actor_email: MOCK_USERS.soc.email, actor_role: 'soc', event: 'resolved', note: 'Domain blocked and the engineering lead was told.', created_at: ago(20 * HOUR) },
      { id: 2, ticket_id: 'INC-2038', actor_email: MOCK_USERS.soc.email, actor_role: 'soc', event: 'assigned', note: MOCK_USERS.soc.email, created_at: ago(22 * HOUR) }],
    'INC-2037': [{ id: 1, ticket_id: 'INC-2037', actor_email: MOCK_USERS.soc.email, actor_role: 'soc', event: 'resolved', note: 'Test report from the HR training session.', created_at: ago(2 * DAY) }],
    'INC-2040': [{ id: 4, ticket_id: 'INC-2040', actor_email: MOCK_USERS.soc.email, actor_role: 'soc', event: 'assigned', note: MOCK_USERS.soc.email, created_at: ago(90 * MIN) }],
  };
  return { events: [...extra, ...(seeded[id] ?? [])] };
};

export const threatFeed = () => {
  const items = [
    ['TC-88', 'http://secure-payroll-update.example/login', 'PHISHING_REPORT', 94, 'Employee Report', 'warning', 'malicious', 'critical', 14, 35 * MIN],
    ['TC-87', 'http://promo-giftcards.example/claim', 'SUSPICIOUS_URL', 61, 'urlscan', 'warning', 'suspicious', 'medium', 2, 7 * HOUR],
    ['TC-86', 'http://git-hub-login.example/session', 'PHISHING_CLICK', 88, 'GoPhish Simulation', 'block', 'malicious', 'high', 11, 1 * DAY],
    ['TC-85', 'invoice-october.pdf.exe', 'MALWARE_DETECTED', 97, 'VirusTotal', 'block', 'malicious', 'critical', 31, 2 * HOUR],
    ['TC-84', 'https://docs.partner-company.example', 'URL_INDICATOR', 5, 'SOC Whitelist', 'allow', 'clean', 'low', 0, 2 * DAY],
  ] as const;
  const feed = items.map(([id, url, threatType, score, source, action, verdict, severity, vt, age]) => ({
    id, url, indicator: url, threatType, score, source, action, verdict, severity, vt_score: vt, urlscan_score: vt ? 40 : 0, detectedAt: ago(age), lastChecked: ago(age),
  }));
  return {
    success: true, feed, cache: feed, total: feed.length,
    timeline: [{ date: 'Oct 03', detections: 1 }, { date: 'Oct 04', detections: 2 }, { date: 'Oct 05', detections: 3 }],
  };
};

export const aiSummaries = () => ({
  summaries: [
    { id: 'SUM-001', timestamp: ago(10 * MIN), title: 'Active threat vectors', threatLevel: 'high',
      summary: '3 open incidents, 2 high severity. Credential-harvesting links are targeting Finance and Operations.',
      recommendations: ['Block payroll look-alike domains at the proxy', 'Send an awareness reminder to Finance'] },
    { id: 'SUM-002', timestamp: ago(10 * MIN), title: 'Employee risk distribution', threatLevel: 'medium',
      summary: '3 of 12 employees are below the warning threshold; Operations has the lowest average score.',
      recommendations: ['Review education warnings in the security inbox'] },
  ],
});

export const policyDecisions = () => ({
  decisions: [
    { id: 'POL-088', timestamp: ago(35 * MIN), threatScore: 94, behaviorScore: 26, finalAction: 'block', reason: 'High threat, vulnerable employee tier', url: 'http://secure-payroll-update.example/login', userId: 'eko.prasetyo@afferent.local', userEmail: 'eko.prasetyo@afferent.local', userTier: 'Vulnerable', division: 'Finance' },
    { id: 'POL-087', timestamp: ago(7 * HOUR), threatScore: 61, behaviorScore: 59, finalAction: 'warning', reason: 'Medium threat, guardian tier', url: 'http://promo-giftcards.example/claim', userId: 'maya.lestari@afferent.local', userEmail: 'maya.lestari@afferent.local', userTier: 'Guardian', division: 'Marketing' },
    { id: 'POL-084', timestamp: ago(2 * DAY), threatScore: 5, behaviorScore: 94, finalAction: 'allow', reason: 'Low threat', url: 'https://docs.partner-company.example', userId: 'andi.kurniawan@afferent.local', userEmail: 'andi.kurniawan@afferent.local', userTier: 'Sentinel', division: 'Engineering' },
  ],
});
export const policyEvaluation = (body: { threatScore?: number; userTier?: string; verdict?: string }) => {
  const score = Number(body.threatScore ?? 50);
  const action = score >= 80 ? 'block' : score >= 40 ? 'warning' : 'allow';
  return { action, reason: `Threat score ${score} for a ${body.userTier || 'Guardian'} employee (${body.verdict || 'unknown'} verdict).` };
};

export const loginHistory = () => ({
  logs: [
    { id: 1, email: 'dimas.anggara@afferent.local', division: 'Security', login_time: ago(20 * MIN), device: 'MacBook Pro (macOS)', location: 'Jakarta, Indonesia', network: 'Corporate LAN', vpn: false, risk: 'LOW', reason: 'Known device and location' },
    { id: 2, email: 'eko.prasetyo@afferent.local', division: 'Finance', login_time: ago(3 * HOUR), device: 'Windows 11 laptop', location: 'Surabaya, Indonesia', network: 'Public Wi-Fi', vpn: false, risk: 'MEDIUM', reason: 'Unfamiliar network' },
    { id: 3, email: 'gilang.permana@afferent.local', division: 'Operations', login_time: ago(9 * HOUR), device: 'Unknown Android device', location: 'Singapore', network: 'Mobile data', vpn: true, risk: 'HIGH', reason: 'New device from a new country over VPN' },
  ],
});

export const complianceSummary = () => ({ compliance_pct: 72, estimated_savings_idr: 1_250_000_000,
  divisi_risk_map: [
    { divisi: 'Engineering', risk_level: 'low', avg_points: 174.3 }, { divisi: 'Human Resources', risk_level: 'low', avg_points: 120 },
    { divisi: 'Marketing', risk_level: 'medium', avg_points: 102.5 }, { divisi: 'Finance', risk_level: 'medium', avg_points: 86.7 },
    { divisi: 'Operations', risk_level: 'high', avg_points: 67.5 },
  ] });

export const readinessThresholds = () => ([
  { clause_id: 'ISO_A63', clause_number: 'ISO 27001:2022 Annex A.6.3', clause_title: 'Information security awareness, education and training', target_value: 85, unit: 'percent', is_legally_mandated: 0, rationale: 'Default based on an industry benchmark report.', updated_at: ago(10 * DAY) },
  { clause_id: 'ISO_A68', clause_number: 'ISO 27001:2022 Annex A.6.8', clause_title: 'Information security event reporting', target_value: 70, unit: 'percent', is_legally_mandated: 0, rationale: 'Default based on report-to-click resilience ratios.', updated_at: ago(10 * DAY) },
  { clause_id: 'ISO_A812', clause_number: 'ISO 27001:2022 Annex A.8.12', clause_title: 'Data leakage prevention', target_value: null, unit: 'percent', is_legally_mandated: 0, rationale: 'No published benchmark; set from your own risk assessment.', updated_at: ago(10 * DAY) },
  { clause_id: 'UU_PDP_35', clause_number: 'UU PDP Pasal 35', clause_title: 'Internal policy & security system obligations for Personal Data Controllers', target_value: null, unit: 'score', is_legally_mandated: 0, rationale: 'Organization-specific.', updated_at: ago(10 * DAY) },
  { clause_id: 'UU_PDP_46', clause_number: 'UU PDP Pasal 46', clause_title: 'Breach notification within 3x24 hours', target_value: 72, unit: 'hours', is_legally_mandated: 1, rationale: 'Fixed by UU PDP No. 27/2022 Pasal 46.', updated_at: ago(10 * DAY) },
]);

export const complianceReadiness = () => {
  const t = readinessThresholds();
  const values = [78, 64, null, 58, 31.5];
  const tiers = ['Strong Readiness', 'Needs Attention', 'Not Configured', 'Not Configured', 'Strong Readiness'];
  return {
    disclaimer: 'Readiness indicators are internal signals derived from behavioral telemetry. They are not a formal certification or audit result.',
    overall_readiness_indicator: 'Partial Readiness',
    clause_readiness: t.map((c, i) => ({
      clause_id: c.clause_id, clause_number: c.clause_number, clause_title: c.clause_title, current_value: values[i], target_value: c.target_value,
      unit: c.unit, is_legally_mandated: Boolean(c.is_legally_mandated), readiness_tier: tiers[i], rationale: c.rationale,
      evidence: { label: 'Mock evidence', formula: 'numerator / denominator x 100', components: { numerator: 9, denominator: 12 } },
    })),
    total_users: 12, total_reports: 21, total_clicks: 27, mean_time_to_close_hours: 31.5,
  };
};

export const securityInbox = () => ({
  threshold: 60, scoreScale: 200, deliveryMode: 'Mailpit (lab)', emailEnabled: true, automatic: false,
  employees: [
    { id: 105, email: 'gilang.permana@afferent.local', divisi: 'Operations', points: 41, canSend: true, delivery: null },
    { id: 105, email: 'eko.prasetyo@afferent.local', divisi: 'Finance', points: 52, canSend: false, delivery: { sent_at: ago(3 * HOUR), last_error: null, created_at: ago(3 * HOUR), attempts: 1 } },
  ],
  reports: urlReports().reports.map(r => ({ ...r, email: 'sinta.maharani@afferent.local' })),
  audit: [{ id: 1, actor_email: MOCK_USERS.soc.email, actor_role: 'soc', recipient: 'eko.prasetyo@afferent.local', score: 52, reason: 'Please complete your security training.', created_at: ago(3 * HOUR) }],
});

/* ── AI intelligence ────────────────────────────────────── */

export const aiHeatmap = () => ({
  _source: 'baseline',
  classifications: sorted.map(p => {
    const level = p.points >= 110 ? 'SAFE' : p.points >= 60 ? 'VULNERABLE' : 'DANGER';
    return { email: p.email, divisi: p.divisi, risk_level: level, risk_score: Math.round(200 - p.points), primary_risk: level === 'SAFE' ? 'None observed' : 'Credential phishing',
      one_line_assessment: level === 'SAFE' ? 'Reports threats promptly.' : 'Clicked simulated links more than once.', education_tip: 'Hover over links to check the real address before clicking.' };
  }),
  org_risk_summary: { safe_count: 6, vulnerable_count: 4, danger_count: 2, most_at_risk_division: 'Operations', overall_assessment: 'Most employees are in a healthy zone; Operations needs targeted training.' },
});
export const aiUser = (email: string) => ({
  email, risk_level: 'VULNERABLE', risk_score: 94, vulnerable_to: ['Credential phishing', 'Invoice scams'],
  risk_factors: ['3 simulated clicks in 30 days', 'Skipped 2 trainings'], positive_factors: ['Reported 1 real threat'],
  education_message: 'You are doing well at reporting. Slow down on invoice-themed emails.', recommendations: ['Complete the invoice-fraud module', 'Enable the proxy on your device'],
  priority_action: 'Complete retraining this week', trend_assessment: 'Improving slowly',
});
export const aiReport = () => ({
  markdown_report: '# Weekly Security Awareness Report\n\n## Highlights\n- 3 open incidents, 2 high severity\n- Reporting rate up 12% week over week\n\n## Recommendations\n1. Targeted training for Operations\n2. Review look-alike payroll domains\n',
  total_employees: 12, risk_distribution: { SAFE: 6, VULNERABLE: 4, DANGER: 2 }, period_days: 7,
});

/* ── Phishing admin (campaign tooling) ──────────────────── */

export const campaigns = () => ([
  { id: 11, source: 'gophish', name: 'Q3 Invoice Lure', status: 'In progress', created_date: ago(3 * DAY),
    stats: { total: 12, sent: 12, opened: 8, clicked: 4, submitted_data: 1, error: 0 },
    results: [
      { email: 'eko.prasetyo@afferent.local', status: 'Submitted Data', first_name: 'Eko', last_name: 'Prasetyo', position: 'Analyst', send_date: ago(3 * DAY) },
      { email: 'budi.hartono@afferent.local', status: 'Clicked Link', first_name: 'Budi', last_name: 'Hartono', position: 'Coordinator', send_date: ago(3 * DAY) },
    ],
    timeline: [{ email: 'eko.prasetyo@afferent.local', time: ago(3 * DAY), message: 'Submitted Data' }] },
  { id: 12, source: 'local', name: 'Password Reset Drill', status: 'Completed', created_date: ago(12 * DAY),
    stats: { total: 12, sent: 12, opened: 10, clicked: 5, submitted_data: 2, error: 0 }, results: [], timeline: [] },
]);
export const gophishResources = () => ({
  connected: true, phishUrl: 'http://127.0.0.1:8080', educationUrl: 'http://127.0.0.1:3000/simulation/education',
  adminUrl: 'https://localhost:3333', mailpitUrl: 'http://127.0.0.1:8025',
  templates: [{ id: 1, name: 'Invoice overdue', subject: 'Action required: invoice #4821', html: '<p>Please review the attached invoice.</p>', text: 'Please review the attached invoice.' }],
  profiles: [{ id: 1, name: 'Mailpit lab sender', host: 'mailpit:1025', from_address: 'it-support@afferent.local' }],
  pages: [{ id: 1, name: 'Fake payroll login', html: '<form><input name="email"><input name="password" type="password"></form>', capture_credentials: true, capture_passwords: false, redirect_url: '' }],
});

/* ── Proxy ──────────────────────────────────────────────── */

export const proxyDevice = (registered: boolean) => ({
  registered, connected: registered,
  ...(registered ? { deviceId: 'dev-mock-01', label: 'Perangkat utama', sourceIpHint: '10.0.12.x', lastProxySeenAt: ago(2 * MIN) } : {}),
});
export const proxyAlerts = () => ({
  alerts: [
    { id: '3f2b9c1e-5a7d-4e1b-9c3a-1d2e3f4a5b6c', domain: 'secure-payroll-update.example', employee_email: 'eko.prasetyo@afferent.local', urgency: 'Critical', status: 'open', verdict: 'malicious', reason: 'ML model flagged a credential-harvesting pattern.', confidence: 0.94, source: 'ml', created_at: ago(20 * MIN) },
    { id: '8a1d4c7e-2b5f-4a90-8c6d-7e8f9a0b1c2d', domain: 'promo-giftcards.example', employee_email: 'maya.lestari@afferent.local', urgency: 'Unknown', status: 'open', verdict: 'unknown', reason: 'Newly registered domain with no reputation.', confidence: null, source: 'ml', created_at: ago(2 * HOUR) },
    { id: 'c4e6a8b0-1d3f-4b5c-9e7a-2f4d6b8c0a1e', domain: 'git-hub-login.example', employee_email: 'andi.kurniawan@afferent.local', urgency: 'Critical', status: 'blocked', verdict: 'malicious', reason: 'Employee report confirmed by SOC.', confidence: 0.88, source: 'employee_report', created_at: ago(1 * DAY) },
  ],
});
export const proxyVerdicts = () => ({
  verdicts: [
    { id: 'v1', domain: 'git-hub-login.example', source: 'soc', decision: 'block', reason: 'Look-alike login page', confidence: 0.88, model_version: null, updated_at: ago(1 * DAY) },
    { id: 'v2', domain: 'docs.partner-company.example', source: 'soc', decision: 'allow', reason: 'Approved vendor', confidence: null, model_version: null, updated_at: ago(2 * DAY) },
    { id: 'v3', domain: 'invoice-portal.example', source: 'ml', decision: 'block', reason: 'Model confidence 91%', confidence: 0.91, model_version: 'domain_v3', updated_at: ago(3 * DAY) },
  ],
});
export const proxyTraffic = () => ({
  events: [
    { event_id: 'e1', domain: 'secure-payroll-update.example', employee_email: 'eko.prasetyo@afferent.local', method: 'CONNECT', port: 443, action: 'allow', decision_source: 'unknown', reason: 'No verdict yet', occurred_at: ago(20 * MIN) },
    { event_id: 'e2', domain: 'git-hub-login.example', employee_email: 'andi.kurniawan@afferent.local', method: 'CONNECT', port: 443, action: 'block', decision_source: 'soc', reason: 'SOC block', occurred_at: ago(45 * MIN) },
    { event_id: 'e3', domain: 'docs.partner-company.example', employee_email: 'sinta.maharani@afferent.local', method: 'CONNECT', port: 443, action: 'allow', decision_source: 'soc', reason: 'SOC allow', occurred_at: ago(50 * MIN) },
  ],
});
export const secondOpinion = (domain: string) => ({
  status: 'completed', model: 'mock-local-llm',
  result: { assessment: 'likely_phishing', category: 'credential_harvesting', reason: `The hostname "${domain}" imitates a payroll service using urgency words.`, elapsedMs: 1840 },
});
