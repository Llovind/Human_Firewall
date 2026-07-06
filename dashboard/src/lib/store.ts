/**
 * In-memory data store for the Presentation Layer.
 *
 * Architecture rule: Dashboard does NOT own a database.
 * This store acts as a temporary buffer between:
 *   - Backend webhooks (POST /api/incident, /api/cache, /api/summary)
 *   - React UI polling (GET requests every 3 seconds)
 *
 * In production, this would be replaced by Redis or a message queue.
 * For Hackathon demo, in-memory is perfectly fine.
 */

// ── Types ────────────────────────────────────────────────────

export interface Incident {
  id: string;
  timestamp: string;
  type: 'phishing_click' | 'phishing_report' | 'malware_detected' | 'suspicious_url' | 'dlp_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  assignee?: string;
}

export interface ThreatCacheEntry {
  id: string;
  url: string;
  threatType: 'phishing' | 'malware' | 'suspicious' | 'safe';
  score: number; // 0-100
  source: 'VirusTotal' | 'urlscan' | 'internal' | 'user_report';
  action: 'allow' | 'warning' | 'block';
  detectedAt: string;
  lastChecked: string;
}

export interface AISummary {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  relatedIncidents: string[];
}

export interface BehaviorScore {
  userId: string;
  userName: string;
  email: string;
  division: string;
  score: number; // 0-100
  risk: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  lastUpdated: string;
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
  finalAction: 'allow' | 'warning' | 'block' | 'notify_soc';
  reason: string;
  url?: string;
  userId?: string;
}

export interface AuthToken {
  token: string;
  email: string;
  userName: string;
  division: string;
  telegramId: string;
  createdAt: number;
  expiresAt: number;
}

// ── In-Memory Store ──────────────────────────────────────────

class DataStore {
  private incidents: Incident[] = [];
  private threatCache: ThreatCacheEntry[] = [];
  private aiSummaries: AISummary[] = [];
  private behaviorScores: BehaviorScore[] = [];
  private policyDecisions: PolicyDecision[] = [];
  private authTokens: Map<string, AuthToken> = new Map();

  // ── Incidents ──
  addIncident(incident: Incident) {
    this.incidents.unshift(incident); // newest first
    if (this.incidents.length > 100) this.incidents.pop();
  }
  getIncidents(): Incident[] {
    return [...this.incidents];
  }

  // ── Threat Cache ──
  addThreatCache(entry: ThreatCacheEntry) {
    // Upsert by URL
    const idx = this.threatCache.findIndex(e => e.url === entry.url);
    if (idx >= 0) {
      this.threatCache[idx] = entry;
    } else {
      this.threatCache.unshift(entry);
      if (this.threatCache.length > 200) this.threatCache.pop();
    }
  }
  getThreatCache(): ThreatCacheEntry[] {
    return [...this.threatCache];
  }

  // ── AI Summaries ──
  addAISummary(summary: AISummary) {
    this.aiSummaries.unshift(summary);
    if (this.aiSummaries.length > 50) this.aiSummaries.pop();
  }
  getAISummaries(): AISummary[] {
    return [...this.aiSummaries];
  }

  // ── Behavior Scores ──
  updateBehaviorScore(score: BehaviorScore) {
    const idx = this.behaviorScores.findIndex(s => s.userId === score.userId);
    if (idx >= 0) {
      this.behaviorScores[idx] = score;
    } else {
      this.behaviorScores.push(score);
    }
  }
  getBehaviorScores(): BehaviorScore[] {
    return [...this.behaviorScores];
  }
  getBehaviorScoreByEmail(email: string): BehaviorScore | undefined {
    return this.behaviorScores.find(s => s.email === email);
  }

  // ── Policy Decisions ──
  addPolicyDecision(decision: PolicyDecision) {
    this.policyDecisions.unshift(decision);
    if (this.policyDecisions.length > 100) this.policyDecisions.pop();
  }
  getPolicyDecisions(): PolicyDecision[] {
    return [...this.policyDecisions];
  }

  // ── Auth Tokens (Magic Links) ──
  createAuthToken(token: AuthToken) {
    this.authTokens.set(token.token, token);
  }
  validateAuthToken(tokenStr: string): AuthToken | null {
    const token = this.authTokens.get(tokenStr);
    if (!token) return null;
    if (Date.now() > token.expiresAt) {
      this.authTokens.delete(tokenStr);
      return null;
    }
    // One-time use: delete after validation (except for the demo token)
    if (tokenStr !== 'demo-magic-link-2026') {
      this.authTokens.delete(tokenStr);
    }
    return token;
  }

  // ── Stats ──
  getStats() {
    const incidents = this.incidents;
    return {
      totalIncidents: incidents.length,
      openIncidents: incidents.filter(i => i.status === 'open').length,
      criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
      blockedUrls: this.threatCache.filter(t => t.action === 'block').length,
      totalEmployees: this.behaviorScores.length,
      avgBehaviorScore: this.behaviorScores.length > 0
        ? Math.round(this.behaviorScores.reduce((sum, s) => sum + s.score, 0) / this.behaviorScores.length)
        : 0,
    };
  }
}

// Singleton — persists across API route invocations in the same Node.js process
const globalForStore = globalThis as unknown as { dataStore: DataStore };
export const dataStore = globalForStore.dataStore || new DataStore();
if (!globalForStore.dataStore) globalForStore.dataStore = dataStore;
