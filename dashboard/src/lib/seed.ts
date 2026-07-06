/**
 * Mock data seed — pre-populates the in-memory store with realistic demo data
 * so the dashboard looks alive immediately during the Hackathon demo.
 * 
 * This runs once on first GET request if the store is empty.
 */

import { dataStore } from './store';
import type {
  Incident, ThreatCacheEntry, AISummary,
  BehaviorScore, PolicyDecision, AuthToken
} from './store';

let seeded = false;

export function seedIfEmpty() {
  // Always guarantee the demo token exists for convenience
  dataStore.createAuthToken({
    token: 'demo-magic-link-2026',
    email: 'lovind@netengineering-dummy.local',
    userName: 'Lovind',
    division: 'IT',
    telegramId: '123456789',
    createdAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  });

  // Always guarantee the demo behavior score exists for convenience
  if (!dataStore.getBehaviorScoreByEmail('lovind@netengineering-dummy.local')) {
    dataStore.updateBehaviorScore({
      userId: 'USR-000',
      userName: 'Lovind',
      email: 'lovind@netengineering-dummy.local',
      division: 'IT',
      score: 85,
      risk: 'low',
      reason: 'Kepatuhan sangat baik. Selalu tanggap terhadap email mencurigakan.',
      lastUpdated: new Date().toISOString(),
      streak: 4,
      rank: 3,
      totalPoints: 120,
      trainingCompleted: 3,
      badges: ['First Report', 'Guardian'],
    });
  }

  if (seeded) return;
  if (dataStore.getIncidents().length > 0) { seeded = true; return; }

  // ── Incidents ──
  const incidents: Incident[] = [
    {
      id: 'INC-001',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      type: 'phishing_click',
      severity: 'high',
      source: 'GoPhish Campaign #3',
      target: 'budi@netengineering-dummy.local',
      description: 'User clicked phishing link in simulated campaign targeting Network Engineering division.',
      status: 'investigating',
      assignee: 'SOC-Team',
    },
    {
      id: 'INC-002',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      type: 'phishing_report',
      severity: 'medium',
      source: 'Telegram Bot Report',
      target: 'sari@netops-dummy.local',
      description: 'User reported suspicious email containing credential harvesting link via Telegram Bot.',
      status: 'resolved',
    },
    {
      id: 'INC-003',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      type: 'suspicious_url',
      severity: 'critical',
      source: 'Adaptive Gateway',
      target: 'https://fakebank-login.xyz/verify',
      description: 'Adaptive Secure Gateway blocked access to known credential harvesting domain.',
      status: 'escalated',
      assignee: 'SOC-Lead',
    },
    {
      id: 'INC-004',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      type: 'malware_detected',
      severity: 'high',
      source: 'DLP Guard',
      target: 'invoice_q3_final.pdf.exe',
      description: 'DLP Guard detected double-extension executable disguised as PDF attachment.',
      status: 'open',
    },
    {
      id: 'INC-005',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'phishing_report',
      severity: 'low',
      source: 'Telegram Bot Report',
      target: 'rina@perfshared-dummy.local',
      description: 'User reported marketing email as suspicious. Analysis shows legitimate sender.',
      status: 'resolved',
    },
  ];
  incidents.forEach(i => dataStore.addIncident(i));

  // ── Threat Cache ──
  const cache: ThreatCacheEntry[] = [
    {
      id: 'TC-001',
      url: 'https://fakebank-login.xyz/verify',
      threatType: 'phishing',
      score: 95,
      source: 'VirusTotal',
      action: 'block',
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
      lastChecked: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 'TC-002',
      url: 'https://docs-g00gle.com/share/d/1x',
      threatType: 'phishing',
      score: 88,
      source: 'urlscan',
      action: 'block',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
      lastChecked: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 'TC-003',
      url: 'https://short.link/a8k2m',
      threatType: 'suspicious',
      score: 62,
      source: 'internal',
      action: 'warning',
      detectedAt: new Date(Date.now() - 1800000).toISOString(),
      lastChecked: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: 'TC-004',
      url: 'https://newsletter.company-internal.com',
      threatType: 'safe',
      score: 5,
      source: 'internal',
      action: 'allow',
      detectedAt: new Date(Date.now() - 86400000).toISOString(),
      lastChecked: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'TC-005',
      url: 'https://free-iphone15.win/claim',
      threatType: 'malware',
      score: 99,
      source: 'VirusTotal',
      action: 'block',
      detectedAt: new Date(Date.now() - 5400000).toISOString(),
      lastChecked: new Date(Date.now() - 120000).toISOString(),
    },
  ];
  cache.forEach(c => dataStore.addThreatCache(c));

  // ── AI Summaries ──
  const summaries: AISummary[] = [
    {
      id: 'SUM-001',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      title: 'Credential Harvesting Campaign Detected',
      summary: 'A coordinated phishing campaign targeting Network Engineering division has been identified. The attack uses spoofed Microsoft 365 login pages hosted on newly registered domains. 3 employees clicked the link, 2 submitted credentials before the Adaptive Gateway blocked the domain.',
      threatLevel: 'critical',
      recommendations: [
        'Force password reset for affected accounts',
        'Enable MFA on all Microsoft 365 accounts',
        'Brief Network Engineering team on phishing indicators',
      ],
      relatedIncidents: ['INC-001', 'INC-003'],
    },
    {
      id: 'SUM-002',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      title: 'Malicious PDF Attachment Analysis',
      summary: 'DLP Guard intercepted a double-extension file (invoice_q3_final.pdf.exe) sent via internal email. The file contains embedded PowerShell commands that attempt to download a second-stage payload from a C2 server. The Behavior Engine flagged the sender account as compromised.',
      threatLevel: 'high',
      recommendations: [
        'Quarantine the sender account immediately',
        'Scan all endpoints that received the email',
        'Block the C2 domain at firewall level',
      ],
      relatedIncidents: ['INC-004'],
    },
  ];
  summaries.forEach(s => dataStore.addAISummary(s));

  // ── Behavior Scores ──
  const behaviors: BehaviorScore[] = [
    {
      userId: 'USR-000', userName: 'Lovind', email: 'lovind@netengineering-dummy.local',
      division: 'IT', score: 85, risk: 'low', reason: 'Kepatuhan sangat baik. Selalu tanggap terhadap email mencurigakan.',
      lastUpdated: new Date().toISOString(), streak: 4, rank: 3, totalPoints: 120,
      trainingCompleted: 3, badges: ['First Report', 'Guardian'],
    },
    {
      userId: 'USR-001', userName: 'Rina Kusuma', email: 'rina.kusuma@netengineering-dummy.local',
      division: 'Network Engineering', score: 25, risk: 'high', reason: 'Sering mengklik tautan phishing dalam simulasi. Perlu mengikuti pelatihan tambahan.',
      lastUpdated: new Date().toISOString(), streak: 0, rank: 14, totalPoints: 15,
      trainingCompleted: 0, badges: [],
    },
    {
      userId: 'USR-002', userName: 'Budi Santoso', email: 'budi.santoso@netops-dummy.local',
      division: 'Network Operations', score: 68, risk: 'medium', reason: 'Kewaspadaan baik. Mengklik 2 link simulasi namun rajin menyelesaikan modul pelatihan ulang.',
      lastUpdated: new Date().toISOString(), streak: 2, rank: 5, totalPoints: 75,
      trainingCompleted: 2, badges: ['First Report', 'Guardian'],
    },
    {
      userId: 'USR-003', userName: 'Martina Fitri', email: 'martina.fitri@perfshared-dummy.local',
      division: 'Performance & Shared Service', score: 95, risk: 'low', reason: 'Kepatuhan sempurna. Selalu melaporkan email mencurigakan dan menyelesaikan semua pelatihan.',
      lastUpdated: new Date().toISOString(), streak: 6, rank: 1, totalPoints: 140,
      trainingCompleted: 5, badges: ['First Report', 'Streak Master', 'Quiz Champion', 'Sentinel'],
    },
    {
      userId: 'USR-004', userName: 'Dewi Lestari', email: 'dewi.lestari@netops-dummy.local',
      division: 'Network Operations', score: 15, risk: 'high', reason: 'Memiliki riwayat klik tinggi pada email simulasi (6 klik). Tindakan pembinaan SOC diperlukan.',
      lastUpdated: new Date().toISOString(), streak: 0, rank: 15, totalPoints: 10,
      trainingCompleted: 0, badges: [],
    },
    {
      userId: 'USR-005', userName: 'Eko Prabowo', email: 'eko.prabowo@perfshared-dummy.local',
      division: 'Performance & Shared Service', score: 52, risk: 'medium', reason: 'Perilaku sedang. Pernah mengklik link phishing sekali, namun mulai rajin mengikuti pelatihan.',
      lastUpdated: new Date().toISOString(), streak: 1, rank: 8, totalPoints: 50,
      trainingCompleted: 1, badges: ['First Report'],
    },
    {
      userId: 'USR-006', userName: 'Yudi Hidayat', email: 'yudi.hidayat@salessupport-dummy.local',
      division: 'Sales Support', score: 90, risk: 'low', reason: 'Perilaku aman. Cepat melaporkan ancaman dan tidak pernah terkena jebakan link tiruan.',
      lastUpdated: new Date().toISOString(), streak: 5, rank: 2, totalPoints: 110,
      trainingCompleted: 4, badges: ['First Report', 'Streak Master', 'Quiz Champion', 'Guardian'],
    },
    {
      userId: 'USR-007', userName: 'Siti Nurhaliza', email: 'siti.nurhaliza@salessupport-dummy.local',
      division: 'Sales Support', score: 72, risk: 'low', reason: 'Perilaku aman. Menunjukkan peningkatan kesadaran keamanan siber yang stabil.',
      lastUpdated: new Date().toISOString(), streak: 3, rank: 4, totalPoints: 85,
      trainingCompleted: 2, badges: ['First Report', 'Guardian'],
    }
  ];
  behaviors.forEach(b => dataStore.updateBehaviorScore(b));

  // ── Policy Decisions ──
  const decisions: PolicyDecision[] = [
    {
      id: 'POL-001', timestamp: new Date(Date.now() - 300000).toISOString(),
      threatScore: 95, behaviorScore: 35, finalAction: 'block',
      reason: 'High threat score + Low behavior score = Maximum enforcement',
      url: 'https://fakebank-login.xyz/verify', userId: 'USR-002',
    },
    {
      id: 'POL-002', timestamp: new Date(Date.now() - 900000).toISOString(),
      threatScore: 62, behaviorScore: 85, finalAction: 'warning',
      reason: 'Medium threat score + High behavior score = Warning only',
      url: 'https://short.link/a8k2m', userId: 'USR-001',
    },
    {
      id: 'POL-003', timestamp: new Date(Date.now() - 1200000).toISOString(),
      threatScore: 99, behaviorScore: 60, finalAction: 'notify_soc',
      reason: 'Critical threat score = SOC notification regardless of behavior',
      url: 'https://free-iphone15.win/claim', userId: 'USR-004',
    },
  ];
  decisions.forEach(d => dataStore.addPolicyDecision(d));

  // ── Pre-seed a demo auth token for testing ──
  const demoToken: AuthToken = {
    token: 'demo-magic-link-2026',
    email: 'lovind@netengineering-dummy.local',
    userName: 'Lovind',
    division: 'IT',
    telegramId: '123456789',
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  dataStore.createAuthToken(demoToken);

  seeded = true;
}
