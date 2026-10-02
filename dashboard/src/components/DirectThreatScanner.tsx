'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  Zap,
  Globe,
  Award,
  Clock,
  CheckCircle2,
  FileCode,
  Flame,
  Layers,
  ArrowRight,
  Info,
  Cpu,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface DirectThreatScannerProps {
  currentUserTier?: string;
  userEmail?: string;
  onScanComplete?: () => void;
}

interface ScanResult {
  success: boolean;
  indicator: string;
  user_tier: string;
  user_email: string;
  cache_hit: boolean;
  is_demo_seed: boolean;
  scanner_busy: boolean;
  analysis: {
    verdict: string;
    severity: string;
    confidence: number;
    source?: string;
    providers?: string[];
    scores?: {
      vt?: number;
      urlscan?: number;
    };
    evidence?: {
      char_bilstm?: {
        provider?: string;
        model_name?: string;
        verdict?: string;
        action?: string;
        threat_type?: string;
        confidence?: number;
        p_malicious?: number;
        adj_confidence?: number;
        adj_p_malicious?: number;
        adj_verdict?: string;
        dl_weight?: number;
        probabilities?: Record<string, number>;
        calibrated?: boolean;
      } | null;
      domain_reputation?: {
        trusted?: boolean;
        suspicious?: boolean;
        trust_level?: string;
        apex_domain?: string;
        hostname?: string;
        reason?: string;
        dl_weight?: number;
      } | null;
      virustotal?: any;
      urlscan?: any;
    };
  };
  policy: {
    action: 'allow' | 'warn' | 'block' | 'checkpoint' | string;
    reason: string;
    confidence: number;
    severity: string;
    verdict: string;
    comparative?: {
      Sentinel?: { action: string; reason: string; userTier: string };
      Guardian?: { action: string; reason: string; userTier: string };
      Vulnerable?: { action: string; reason: string; userTier: string };
    };
  };
  ticket_id?: string | null;
  soc_status?: string | null;
  reward?: {
    awarded: boolean;
    points_awarded?: number;
    points?: number;
    reason?: string;
    daily_count?: number;
    daily_cap?: number;
    wib_date?: string;
    new_points?: number;
    new_badge?: string;
  } | null;
  daily_stats?: {
    daily_count: number;
    daily_cap: number;
    wib_date: string;
  };
}

const DEMO_PRESETS = [
  {
    label: 'MS Support (Safe Whitelist)',
    url: 'https://support.microsoft.com/en-us/windows/security/firewall/risks-of-allowing-apps-through-windows-firewall',
    expected: 'Safe · Tier-1 Domain Whitelist Overrides Char-BiLSTM',
    type: 'safe',
  },
  {
    label: 'Campus Tel-U (Official .ac.id)',
    url: 'https://telkomuniversity.ac.id',
    expected: 'Safe · Institutional TLD Verified',
    type: 'safe',
  },
  {
    label: 'BCA Phishing (Afferent AI)',
    url: 'http://login-bca-klik-verifikasi-update.com',
    expected: 'Malicious · Char-BiLSTM Zero-Day Phishing',
    type: 'malicious',
  },
  {
    label: 'Judol / Scam (Afferent AI)',
    url: 'http://slot-gacor-maxwin-sensational-2026.net',
    expected: 'Malicious · Char-BiLSTM Judol / Scam Model',
    type: 'malicious',
  },
  {
    label: 'Payroll SSO (Suspicious)',
    url: 'https://portal-payroll-sso.xyz/login',
    expected: 'Suspicious · Triggers 2D Policy Divergence',
    type: 'suspicious',
  },
  {
    label: 'Urgent Invoice Dropper',
    url: 'https://finance-urgent-invoice.top/update.exe',
    expected: 'Malicious · Auto Block & SOC Ticket',
    type: 'malicious',
  },
];

export default function DirectThreatScanner({
  currentUserTier = 'Guardian',
  userEmail,
  onScanComplete,
}: DirectThreatScannerProps) {
  const [indicator, setIndicator] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dailyQuota, setDailyQuota] = useState<{ count: number; cap: number; wibDate: string }>({
    count: 0,
    cap: 3,
    wibDate: '',
  });

  // Fetch initial daily reward quota
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/threat/stats');
      if (res.ok) {
        const data = await res.json();
        setDailyQuota({
          count: data.daily_count || 0,
          cap: data.daily_cap || 3,
          wibDate: data.wib_date || '',
        });
      }
    } catch {
      // Fallback silently
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userEmail]);

  const handleScan = async (targetIndicator?: string) => {
    const target = (targetIndicator || indicator).trim();
    if (!target) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch('/api/threat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator: target }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Terjadi kesalahan saat memindai ancaman.');
      } else {
        setResult(data);
        if (data.daily_stats) {
          setDailyQuota({
            count: data.daily_stats.daily_count,
            cap: data.daily_stats.daily_cap,
            wibDate: data.daily_stats.wib_date,
          });
        }
        if (data.reward?.awarded && onScanComplete) {
          onScanComplete();
        }
      }
    } catch {
      setErrorMsg('Koneksi ke backend gateway timeout. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  };

  const renderVerdictBadge = (verdict: string) => {
    const v = (verdict || '').toLowerCase();
    if (v === 'malicious') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            letterSpacing: '0.04em',
          }}
        >
          <ShieldAlert size={14} /> MALICIOUS
        </span>
      );
    }
    if (v === 'suspicious') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            letterSpacing: '0.04em',
          }}
        >
          <AlertTriangle size={14} /> SUSPICIOUS
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 700,
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          color: '#22c55e',
          letterSpacing: '0.04em',
        }}
      >
        <ShieldCheck size={14} /> SAFE
      </span>
    );
  };

  const renderPolicyActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    const styleMap: Record<string, { bg: string; color: string; border: string; label: string }> = {
      allow: {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: '#22c55e',
        border: 'rgba(34, 197, 94, 0.4)',
        label: 'ALLOW',
      },
      warn: {
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.4)',
        label: 'WARN / ADVISORY',
      },
      checkpoint: {
        bg: 'rgba(168, 85, 247, 0.15)',
        color: '#a855f7',
        border: 'rgba(168, 85, 247, 0.4)',
        label: 'SECURITY CHECKPOINT',
      },
      block: {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#ef4444',
        border: 'rgba(239, 68, 68, 0.4)',
        label: 'BLOCK / GATEWAY ISOLATION',
      },
    };
    const current = styleMap[act] || styleMap.allow;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 800,
          background: current.bg,
          border: `1px solid ${current.border}`,
          color: current.color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {current.label}
      </span>
    );
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* ── Header: Title & Quota Tracker ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(13, 71, 161, 0.25))',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Search size={20} />
          </div>
          <div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Direct Threat Scanner
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(33, 150, 243, 0.1)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(33, 150, 243, 0.25)',
                }}
              >
                VirusTotal + urlscan.io + 2D Policy
              </span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Pindai tautan (URL) atau hash file mencurigakan. Analisis instan dengan Adaptive Policy Matrix.
            </p>
          </div>
        </div>

        {/* Daily Bounty Cap Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
          }}
        >
          <Award size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Bounty Harian (WIB):</span>
          <strong style={{ color: dailyQuota.count >= dailyQuota.cap ? '#ef4444' : 'var(--accent)' }}>
            {dailyQuota.count}/{dailyQuota.cap} (+15 pts/threat)
          </strong>
        </div>
      </div>

      {/* ── Input Box & Action Button ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Masukkan URL atau nama file (misal: https://..., phishing.xyz, update.exe)"
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>
          <button
            onClick={() => handleScan()}
            disabled={loading || !indicator.trim()}
            style={{
              padding: '0 24px',
              borderRadius: '8px',
              background: loading ? 'var(--bg-hover)' : 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loading || !indicator.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Memindai...
              </>
            ) : (
              <>
                <Search size={16} /> Scan & Triage
              </>
            )}
          </button>
        </div>

        {/* Demo Seed Preset Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Demo Quick Pick:
          </span>
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setIndicator(preset.url);
                handleScan(preset.url);
              }}
              disabled={loading}
              title={preset.expected}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              <Zap size={11} style={{ color: preset.type === 'safe' ? '#22c55e' : preset.type === 'suspicious' ? '#f59e0b' : '#ef4444' }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rate Limit / Queued Pending Banner ────────────────────────── */}
      {loading && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'rgba(33, 150, 243, 0.06)',
            border: '1px dashed var(--accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid var(--accent)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
              Triase Berlangsung (Queued & Pending API Verification)...
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Memeriksa database threat_cache lokal, feed intelijen global VirusTotal & urlscan.io, serta matriks 2D policy.
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner ────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          {errorMsg}
        </div>
      )}

      {/* ── Analysis Result Section ───────────────────────────────────── */}
      {result && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Top Row: Indicator & Badges */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Hasil Pemindaian Indikator
              </div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  marginTop: '2px',
                }}
              >
                {result.indicator}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Verdict Tag */}
              {renderVerdictBadge(result.analysis.verdict)}

              {/* Cache Status Badge */}
              {result.is_demo_seed ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#a855f7',
                  }}
                  title="Indikator demo di-seed lokal untuk demo hackathon tanpa hambatan rate-limit"
                >
                  <Zap size={12} /> Seeded Demo Cache
                </span>
              ) : result.cache_hit ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(33, 150, 243, 0.15)',
                    border: '1px solid rgba(33, 150, 243, 0.4)',
                    color: 'var(--accent)',
                  }}
                >
                  <Zap size={12} /> Cached Indicator
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(107, 114, 128, 0.15)',
                    border: '1px solid rgba(107, 114, 128, 0.4)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Globe size={12} /> Live API Query
                </span>
              )}
            </div>
          </div>

          {/* Middle Row: 2D Adaptive Policy Matrix Enforcement */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Keputusan 2D Adaptive Policy Engine:
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Tier Login: <strong>{result.user_tier || currentUserTier}</strong>
                </span>
              </div>

              {/* Active Policy Action Badge */}
              {renderPolicyActionBadge(result.policy.action)}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {result.policy.reason}
            </p>

            {/* 2D Comparative Matrix (Sentinel vs Guardian vs Vulnerable) */}
            {result.policy.comparative && (
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  ⚡ Perbandingan Kebijakan Berdasarkan Tier Karyawan (2D Adaptive Convergence):
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {(['Sentinel', 'Guardian', 'Vulnerable'] as const).map((tierKey) => {
                    const comp = result.policy.comparative?.[tierKey];
                    if (!comp) return null;
                    const isMyTier = (result.user_tier || currentUserTier).toLowerCase() === tierKey.toLowerCase();

                    return (
                      <div
                        key={tierKey}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          background: isMyTier ? 'rgba(33, 150, 243, 0.08)' : 'var(--bg-base)',
                          border: isMyTier ? '2px solid var(--accent)' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: isMyTier ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {tierKey} {isMyTier && '★ (You)'}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              color:
                                comp.action === 'block'
                                  ? '#ef4444'
                                  : comp.action === 'warn'
                                  ? '#f59e0b'
                                  : comp.action === 'checkpoint'
                                  ? '#a855f7'
                                  : '#22c55e',
                            }}
                          >
                            {comp.action}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                          {comp.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Deep Learning & Threat Intelligence Evidence Section */}
          {(result.analysis?.evidence?.char_bilstm || result.analysis?.evidence?.domain_reputation) && (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} style={{ color: '#a855f7' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Afferent AI & Multi-Provider Evidence Triangulation:
                  </span>
                </div>
                {result.analysis?.evidence?.domain_reputation?.trusted && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      color: '#22c55e',
                      fontWeight: 700,
                    }}
                  >
                    🛡️ Trusted Apex Whitelist ({result.analysis.evidence.domain_reputation.trust_level || 'verified'})
                  </span>
                )}
              </div>

              {/* Grid: Char-BiLSTM Card + Domain Reputation Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Char-BiLSTM Box */}
                {result.analysis?.evidence?.char_bilstm && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} style={{ color: '#a855f7' }} /> Char-BiLSTM v5.0 (Afferent)
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background:
                            result.analysis.evidence.char_bilstm.verdict === 'malicious'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : result.analysis.evidence.char_bilstm.verdict === 'suspicious'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(34, 197, 94, 0.15)',
                          color:
                            result.analysis.evidence.char_bilstm.verdict === 'malicious'
                              ? '#ef4444'
                              : result.analysis.evidence.char_bilstm.verdict === 'suspicious'
                              ? '#f59e0b'
                              : '#22c55e',
                        }}
                      >
                        {result.analysis.evidence.char_bilstm.verdict?.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Kategori Ancaman: <strong style={{ color: 'var(--text-primary)' }}>{result.analysis.evidence.char_bilstm.threat_type || 'N/A'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Raw P(mal): {((result.analysis.evidence.char_bilstm.p_malicious || 0) * 100).toFixed(1)}%</span>
                      {result.analysis.evidence.char_bilstm.dl_weight !== undefined && (
                        <span>Bobot Domain: {result.analysis.evidence.char_bilstm.dl_weight}×</span>
                      )}
                      <span>Conf: {result.analysis.evidence.char_bilstm.adj_confidence ?? result.analysis.evidence.char_bilstm.confidence}%</span>
                    </div>

                    {result.analysis.evidence.char_bilstm.probabilities && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${((result.analysis.evidence.char_bilstm.probabilities.benign || 0) * 100).toFixed(0)}%`,
                            background: '#22c55e',
                          }}
                          title={`Benign: ${((result.analysis.evidence.char_bilstm.probabilities.benign || 0) * 100).toFixed(1)}%`}
                        />
                        <div
                          style={{
                            width: `${((result.analysis.evidence.char_bilstm.probabilities.phishing || 0) * 100).toFixed(0)}%`,
                            background: '#ef4444',
                          }}
                          title={`Phishing: ${((result.analysis.evidence.char_bilstm.probabilities.phishing || 0) * 100).toFixed(1)}%`}
                        />
                        <div
                          style={{
                            width: `${(((result.analysis.evidence.char_bilstm.probabilities.other || 0) + (result.analysis.evidence.char_bilstm.probabilities.malware || 0)) * 100).toFixed(0)}%`,
                            background: '#f59e0b',
                          }}
                          title={`Judol/Malware: ${(((result.analysis.evidence.char_bilstm.probabilities.other || 0) + (result.analysis.evidence.char_bilstm.probabilities.malware || 0)) * 100).toFixed(1)}%`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Domain Reputation Card */}
                {result.analysis?.evidence?.domain_reputation && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={14} style={{ color: 'var(--accent)' }} /> Domain Intelligence
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: result.analysis.evidence.domain_reputation.trusted
                            ? 'rgba(34, 197, 94, 0.15)'
                            : result.analysis.evidence.domain_reputation.suspicious
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(107, 114, 128, 0.15)',
                          color: result.analysis.evidence.domain_reputation.trusted
                            ? '#22c55e'
                            : result.analysis.evidence.domain_reputation.suspicious
                            ? '#ef4444'
                            : 'var(--text-secondary)',
                        }}
                      >
                        {result.analysis.evidence.domain_reputation.trusted
                          ? 'TRUSTED'
                          : result.analysis.evidence.domain_reputation.suspicious
                          ? 'SUSPECT TLD'
                          : 'NEUTRAL'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Apex: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{result.analysis.evidence.domain_reputation.apex_domain || '-'}</strong>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {result.analysis.evidence.domain_reputation.reason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Row: SOC Dispatch & Reputation Bounty Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* SOC Status Alert */}
            {result.soc_status ? (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: result.ticket_id ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                  border: result.ticket_id ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  color: result.ticket_id ? '#166534' : '#8c6809',
                  fontWeight: 600,
                }}
              >
                {result.ticket_id ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>Status SOC Incident: <strong>{result.soc_status}</strong></span>
              </div>
            ) : null}

            {/* Bounty Reward Alert */}
            {result.reward?.awarded ? (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#166534',
                  fontWeight: 600,
                }}
              >
                <Award size={16} />
                <span>
                  🎉 <strong>+{result.reward.points_awarded} Poin Reputasi Didapatkan!</strong> Kuota reward hari ini: {result.reward.daily_count}/{result.reward.daily_cap} (WIB). Skor baru: {result.reward.new_points} ({result.reward.new_badge}).
                </span>
              </div>
            ) : result.reward ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Info size={13} />
                <span>{result.reward.reason}</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
