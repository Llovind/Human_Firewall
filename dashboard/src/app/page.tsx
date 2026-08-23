'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { useEffect, useState } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import ReportingBadgesWidget from '@/components/ReportingBadgesWidget';
import { 
  LayoutDashboard, Fish, Shield, ShieldCheck, Timer, Lightbulb, Search, 
  Flame, BookOpen, Star, FileWarning, CheckCircle2, AlertTriangle, Trophy, 
  Flag, Info, XCircle, Sparkles, RefreshCw, Globe, Lock, ShieldAlert, 
  ArrowRight, Award, HelpCircle, Check, X, ExternalLink, FileText, Fingerprint 
} from 'lucide-react';
import './dashboard.css';

/* ── Types matching API responses ─────────────────────────── */
interface BehaviorScore {
  userId: string; userName: string; email: string; division: string;
  score: number; risk: string; reason: string; streak: number;
  dailyStreak?: number;
  rank: number; totalPoints: number; trainingCompleted: number; badges: string[];
}
interface UserActivity {
  event_type: string;
  tier_assigned: string | null;
  campaign_id: string | null;
  created_at: string;
}
interface EligibilityResponse {
  eligible: boolean;
  reason?: 'safe' | 'cooldown';
  cooldown_seconds?: number;
  message?: string;
  points?: number;
  behavior_score?: number;
}

/* ── Helper: Time ago ─────────────────────────────────────── */
function timeAgo(ts: string): string {
  let dateStr = ts;
  if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

/* ── Formatting Helpers ───────────────────────────────────── */
const eventLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  clicked_link: { label: 'Mengklik Link Phishing', icon: <Fish size={14} />, color: 'var(--danger)' },
  submitted_data: { label: 'Kebocoran Kredensial', icon: <FileWarning size={14} />, color: 'var(--danger)' },
  viewed_training: { label: 'Mengikuti Retraining', icon: <CheckCircle2 size={14} />, color: 'var(--success)' },
  skipped_training: { label: 'Melewati Retraining', icon: <AlertTriangle size={14} />, color: 'var(--warning)' },
  phishing_click: { label: 'Terjebak Phishing Simulasi', icon: <Fish size={14} />, color: 'var(--danger)' },
  spot_the_fake_correct: { label: 'Menang Spot the Fake (+5 pts)', icon: <Trophy size={14} />, color: 'var(--success)' },
  spot_the_fake_incorrect: { label: 'Kalah Spot the Fake', icon: <AlertTriangle size={14} />, color: 'var(--warning)' },
  report_malicious: { label: 'Melaporkan Ancaman Berbahaya (+15 pts)', icon: <ShieldCheck size={14} />, color: 'var(--text-success)' },
  report_safe: { label: 'Melaporkan URL/File Aman', icon: <CheckCircle2 size={14} />, color: 'var(--accent)' },
  daily_quiz_completed: { label: 'Kuis Harian Selesai & Streak Nambah (+10 pts)', icon: <Flame size={14} />, color: 'var(--text-warning)' },
  quiz_completed: { label: 'Kuis Harian Selesai & Streak Nambah (+10 pts)', icon: <Flame size={14} />, color: 'var(--text-warning)' },
};

export default function EmployeeDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'game' | 'quiz'>('dashboard');

  // ── Polling & state data sources ───
  const behaviorUrl = user 
    ? `/api/behavior?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(user.token || '')}`
    : '';
  const { data: behaviorData, hasUpdated: behaviorUpdated, refresh: pollBehavior } = usePolling<{ scores: BehaviorScore[]; by_divisi?: any[] }>(behaviorUrl, 5000);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);

  // Game Logic State
  const [activePin, setActivePin] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'playing' | 'verdict'>('playing');
  const [userChoice, setUserChoice] = useState<'A' | 'B' | null>(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);

  // Daily Quiz state
  const [quizQuestion, setQuizQuestion] = useState<{
    id: number;
    question_text: string;
    options: string[];
    correct_answer_index: number;
    category: string;
    difficulty: string;
    completed_today?: boolean;
    daily_streak?: number;
  } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizVerdict, setQuizVerdict] = useState<'playing' | 'verdict'>('playing');
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  // Daily Quiz Revive state
  const [quizReviveAvailable, setQuizReviveAvailable] = useState(false);
  const [quizRevivesRemaining, setQuizRevivesRemaining] = useState(0);
  const [quizStreakBeforeBreak, setQuizStreakBeforeBreak] = useState(0);
  const [isSubmittingRevive, setIsSubmittingRevive] = useState(false);

  const fetchDailyQuiz = async () => {
    if (!user) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const storedToken = user.token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null) || 'dev_token';
      const res = await fetch(`/api/quiz/today?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(storedToken)}`);
      if (res.ok) {
        const data = await res.json();
        setQuizQuestion(data);
      } else {
        const errData = await res.json();
        setQuizError(errData.error || 'Gagal memuat kuis harian.');
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setQuizError('Gagal menghubungi server.');
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuizAnswer = async (choiceIndex: number) => {
    if (!user || !quizQuestion || isSubmittingQuiz) return;
    setIsSubmittingQuiz(true);
    setQuizChoice(choiceIndex);

    try {
      const storedToken = user.token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null) || 'dev_token';
      
      const res = await fetch('/api/quiz/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: user.email,
          token: storedToken,
          question_id: quizQuestion.id,
          selected_option_index: choiceIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuizReviveAvailable(data.revive_available || false);
        setQuizRevivesRemaining(data.revives_remaining || 0);
        setQuizStreakBeforeBreak(data.streak_before_break || 0);

        setQuizVerdict('verdict');
        pollBehavior(); // Refresh stats (points, streak)
      } else {
        alert('Gagal mengirim status kuis.');
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      alert('Gagal merekam kuis.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleReviveStreak = async () => {
    if (!user || isSubmittingRevive) return;
    setIsSubmittingRevive(true);

    try {
      const storedToken = user.token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null) || 'dev_token';
      
      const res = await fetch('/api/quiz/revive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: user.email,
          token: storedToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('Streak Anda berhasil dipulihkan!');
        setQuizReviveAvailable(false);
        setQuizQuestion(prev => prev ? { ...prev, daily_streak: data.daily_streak, completed_today: true } : null);
        setQuizVerdict('playing');
        pollBehavior();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal memulihkan streak.');
      }
    } catch (err) {
      console.error('Error reviving streak:', err);
      alert('Gagal menghubungi server.');
    } finally {
      setIsSubmittingRevive(false);
    }
  };

  const handleFinishQuiz = () => {
    setQuizVerdict('playing');
    setQuizChoice(null);
    setQuizQuestion(null);
    setActiveTab('dashboard');
  };

  useEffect(() => {
    if (activeTab === 'quiz' && !quizQuestion) {
      fetchDailyQuiz();
    }
  }, [activeTab, user]);

  // ── Clock ───
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Fetch User Activities & Eligibility ───
  const loadUserActivities = async () => {
    if (!user) return;
    try {
      const storedToken = user.token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null) || 'dev_token';
      
      const res = await fetch(`/api/user-activity?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(storedToken)}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  };

  const checkEligibility = async () => {
    if (!user) return;
    try {
      const storedToken = user.token || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null) || 'dev_token';
      const res = await fetch(`/api/user-eligibility?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(storedToken)}`);
      if (res.ok) {
        const data = await res.json();
        setEligibility(data);
        if (data.cooldown_seconds) {
          setCooldownTime(data.cooldown_seconds);
        }
      }
    } catch (err) {
      console.error('Error checking eligibility:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserActivities();
      checkEligibility();
    }
  }, [user, activeTab]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownTime === null || cooldownTime <= 0) return;
    const interval = setInterval(() => {
      setCooldownTime(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          checkEligibility(); // Recheck eligibility when cooldown expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownTime]);

  const formatCooldown = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit Spot the Fake answer
  const submitAnswer = async (choice: 'A' | 'B') => {
    if (!user || isSubmittingEvent) return;
    
    setIsSubmittingEvent(true);
    setUserChoice(choice);
    
    // Portal A is Fake. Portal B is Real.
    // If choice === 'B', user marked Portal B as fake -> INCORRECT (B is Real).
    // If choice === 'A', user marked Portal A as fake -> CORRECT (A is Fake).
    const isCorrect = choice === 'A';
    const eventType = isCorrect ? 'spot_the_fake_correct' : 'spot_the_fake_incorrect';

    try {
      const res = await fetch('/api/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          event_type: eventType,
          divisi: user.division,
        }),
      });

      if (res.ok) {
        setGameState('verdict');
        pollBehavior(); // Refetch behavior score
      } else {
        alert('Gagal mengirim jawaban.');
      }
    } catch {
      alert('Gagal merekam data game.');
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleFinishVerdict = () => {
    setGameState('playing');
    setUserChoice(null);
    setActivePin(null);
    setActiveTab('dashboard'); // Go back to dashboard
  };

  // ── Redirect if not authenticated ───
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Logo size={48} variant="mark" logoAnimation="loading" />
        <p>Memuat Dashboard Anda...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
    return null;
  }

  if (user.role) {
    const roleRoutes: Record<string, string> = {
      admin: '/admin',
      soc: '/dashboard/soc',
      ciso: '/dashboard/ciso',
      grc: '/dashboard/grc',
      phishing_admin: '/dashboard/phishing-admin',
    };
    if (roleRoutes[user.role]) {
      if (typeof window !== 'undefined') {
        window.location.href = roleRoutes[user.role];
      }
      return null;
    }
  }

  const scores = behaviorData?.scores || [];
  const myScore = scores.find(s => s.email === user.email);

  // Calculate division averages and rankings
  const divisionAverages = behaviorData?.by_divisi 
    ? behaviorData.by_divisi.map((d: any) => ({ division: d.division, avg: d.avg })).sort((a: any, b: any) => b.avg - a.avg)
    : Object.entries(
        scores.reduce((acc, curr) => {
          if (!acc[curr.division]) acc[curr.division] = [];
          acc[curr.division].push(curr.score);
          return acc;
        }, {} as Record<string, number[]>)
      ).map(([division, scoresList]) => {
        const avg = Math.round(scoresList.reduce((a, b) => a + b, 0) / scoresList.length);
        return { division, avg };
      }).sort((a, b) => b.avg - a.avg);

  const myDivRankIdx = myScore ? divisionAverages.findIndex(d => d.division === myScore.division) : -1;
  const myDivRank = myDivRankIdx !== -1 ? myDivRankIdx + 1 : null;

  const tips = [
    "Jangan pernah membagikan kode OTP atau kata sandi Anda kepada siapa pun, termasuk admin.",
    "Periksa nama domain pengirim email secara teliti sebelum mengklik link apa pun.",
    "Aktifkan Multi-Factor Authentication (MFA) di semua akun kerja Anda.",
    "Hindari mengunduh file dengan ekstensi ganda seperti laporan.pdf.exe.",
    "Selalu lapor ke tim SOC jika Anda mencurigai adanya email phishing."
  ];
  const currentTip = tips[myScore ? Math.floor(myScore.score % tips.length) : 0];

  return (
    <div className="app">
      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-brand">
            <Logo variant="full" size={28} />
          </div>
          <nav className="topbar-nav">
            {(['dashboard', 'game', 'quiz'] as const).map(tab => (
              <button
                key={tab}
                className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'dashboard' ? <><LayoutDashboard size={14} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> My Dashboard</> : 
                 tab === 'game' ? <><Fish size={14} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Spot the Fake</> :
                 <><BookOpen size={14} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Daily Quiz</>}
              </button>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <a
            href="/blocked?url=https://portal-keuangan-company.xyz/login&source=URLScan&score=94&type=Credential%20Harvesting"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '4px',
              color: '#f87171',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginRight: '8px'
            }}
          >
            🚨 Demo Gateway Block
          </a>
          <div className="live-indicator">
            <span className="live-dot" />
            <span>Karyawan</span>
          </div>
          <span className="clock mono">{clock}</span>
          <ThemeToggle />
          <div className="user-badge" onClick={logout} title="Klik untuk logout">
            <span className="user-avatar">{user.userName.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.userName}</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="main">
        {/* ── MY DASHBOARD TAB ─────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            <div className="employee-dashboard-layout">
              <div className="employee-left-col" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Hero Card */}
                {myScore ? (
                  <div className={`my-score-card glass-card ${behaviorUpdated ? 'value-flash' : ''}`} style={{ width: '100%', height: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="my-score-header">
                      <div className="my-score-avatar">{myScore.userName.charAt(0)}</div>
                      <div className="my-score-info">
                        <h3>{myScore.userName}</h3>
                        <span className="my-score-division">{myScore.division}</span>
                      </div>
                      <span className={`badge badge-${myScore.risk}`} style={{ fontSize: '12px', padding: '6px 12px' }}>
                        {myScore.risk === 'low' ? 'SECURE' : myScore.risk === 'medium' ? 'MEDIUM RISK' : 'CRITICAL RISK'}
                      </span>
                    </div>
                    <div className="my-score-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '24px 0' }}>
                      <div className="score-ring-container" title="Poin Kepatuhan Keamanan Siber (0-200 pts)">
                        <svg className="score-ring" viewBox="0 0 120 120" style={{ width: '150px', height: '150px' }}>
                          <circle className="score-ring-bg" cx="60" cy="60" r="52" />
                          <circle
                            className="score-ring-fill"
                            cx="60" cy="60" r="52"
                            style={{
                              strokeDasharray: `${((myScore.totalPoints || 0) / 200) * 326.73} 326.73`,
                              stroke: (myScore.totalPoints || 0) >= 130 ? 'var(--success)' : (myScore.totalPoints || 0) >= 60 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          />
                        </svg>
                        <div className="score-ring-value">
                          <span className="score-number" style={{ fontSize: '32px' }}>{myScore.totalPoints}</span>
                          <span className="score-label">Points / 200</span>
                        </div>
                      </div>
                      <div className="my-score-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Trophy size={14} /></span>
                          <span className="mini-stat-value">#{myScore.rank}</span>
                          <span className="mini-stat-label">Rank Perusahaan</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><ShieldCheck size={14} /></span>
                          <span className="mini-stat-value">{myScore.streak} minggu</span>
                          <span className="mini-stat-label">Bebas Klik</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Star size={14} /></span>
                          <span className="mini-stat-value">{myScore.score}%</span>
                          <span className="mini-stat-label">Skor Rating</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Flame size={14} /></span>
                          <span className="mini-stat-value">{myScore.dailyStreak || 0} hari</span>
                          <span className="mini-stat-label">Daily Streak</span>
                        </div>
                      </div>
                    </div>
                    {(myScore.badges || []).length > 0 && (
                      <div className="my-score-badges" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(myScore.badges || []).map(b => {
                          const config = (({
                            'First Report': { icon: <Flag size={12} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)' },
                            'Streak Master': { icon: <Flame size={12} />, color: '#e8a33d', bg: 'rgba(232, 163, 61, 0.08)', border: 'rgba(232, 163, 61, 0.2)' },
                            'Guardian': { icon: <ShieldCheck size={12} />, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)' },
                            'Quiz Champion': { icon: <Trophy size={12} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)' },
                            'Sentinel': { icon: <Shield size={12} />, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.2)' }
                          } as Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }>)[b]) || { icon: <Shield size={12} />, color: 'var(--accent)', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)' };

                          return (
                            <span key={b} className="badge-chip" style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: config.bg,
                              border: `1px solid ${config.border}`,
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              color: config.color,
                              fontWeight: 500
                            }}>
                              {config.icon}
                              {b}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="panel glass-card" style={{ height: 'auto' }}>
                    Memuat skor Anda...
                  </div>
                )}

                {/* Achievements Showcase (Combined Widget) */}
                {myScore && (
                  <ReportingBadgesWidget email={user.email} token={user.token} legacyBadges={myScore.badges || []} />
                )}

                {/* Daily Tip Card */}
                {myScore && (
                  <div className="panel glass-card" style={{ marginTop: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '8px' }}>
                      <div style={{
                        width: '40px', height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(251, 191, 36, 0.12)',
                        color: 'var(--warning)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Lightbulb size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Tip Keamanan Hari Ini</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                          "{currentTip}"
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="employee-right-col" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Timeline Activity Feed */}
                <div className="panel glass-card">
                  <div className="panel-header">
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> Log Aktivitas Keamanan Anda</h2>
                    <span className="panel-count">{activities.length} aktivitas</span>
                  </div>
                   <div style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '8px', paddingBottom: '24px' }} className="timeline-scroll-container">
                    <div className="timeline" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '32px', borderLeft: '2px solid var(--border)', marginLeft: '16px' }}>
                      {activities.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '-32px' }}>Belum ada log aktivitas keamanan tercatat.</p>
                      ) : (
                        activities.map((act, i) => {
                          const details = eventLabels[act.event_type] || { label: act.event_type, icon: <FileWarning size={14} />, color: 'var(--text-muted)' };
                          return (
                            <div key={i} className="timeline-item" style={{ position: 'relative' }}>
                              <span className="timeline-dot" style={{ position: 'absolute', left: '-41px', top: '2px', background: details.color, border: '4px solid var(--bg-surface)', width: '16px', height: '16px', borderRadius: '50%' }} />
                              <div className="timeline-content">
                                <div className="timeline-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                    {details.icon} {details.label}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {timeAgo(act.created_at)}
                                  </span>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  Aksi dicatat pada portal simulasi/ Telegram Bot.{' '}
                                  {act.campaign_id ? `Kampanye ID: ${act.campaign_id}` : ''}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Division Leaderboard Widget */}
                <div className="panel glass-card">
                  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={18} style={{ color: 'var(--accent)' }} /> Peringkat Kompetisi Divisi
                    </h2>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono-data)', color: 'var(--text-muted)' }}>Top Divisions</span>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    {myScore && myDivRank && (
                      <div style={{
                        background: 'rgba(33, 150, 243, 0.05)',
                        border: '1px solid rgba(144, 202, 249, 0.4)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                        fontSize: '12.5px',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                          <Info size={16} />
                        </span>
                        <span>
                          Divisi Anda <strong>{myScore.division}</strong> saat ini berada di peringkat <strong>#{myDivRank}</strong> dari <strong>{divisionAverages.length}</strong> divisi dengan rata-rata <strong style={{ color: 'var(--brand-royal)' }}>{divisionAverages[myDivRankIdx]?.avg} pts</strong>.
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {divisionAverages.slice(0, 5).map((div, idx) => {
                        const isMyDiv = div.division === myScore?.division;
                        const rankStyles = [
                          { bg: 'rgba(247, 216, 127, 0.25)', border: '#F7D87F', text: '#8c6809', label: '1' },
                          { bg: 'rgba(144, 202, 249, 0.25)', border: '#90CAF9', text: '#0D47A1', label: '2' },
                          { bg: 'rgba(205, 127, 50, 0.18)', border: 'rgba(205, 127, 50, 0.5)', text: '#9a3412', label: '3' },
                        ];
                        const rankStyle = rankStyles[idx] || { bg: 'var(--bg-elevated)', border: 'var(--border)', text: 'var(--text-muted)', label: `${idx + 1}` };
                        const maxAvg = divisionAverages[0]?.avg || 200;
                        const pct = Math.min(100, Math.max(10, Math.round((div.avg / maxAvg) * 100)));

                        return (
                          <div
                            key={div.division}
                            style={{
                              background: isMyDiv ? '#f0f7ff' : '#ffffff',
                              border: isMyDiv ? '1.5px solid var(--accent)' : '1px solid rgba(144, 202, 249, 0.45)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              boxShadow: isMyDiv ? '0 2px 10px rgba(33, 150, 243, 0.12)' : '0 1px 3px rgba(9, 27, 56, 0.04)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    background: rankStyle.bg,
                                    border: `1px solid ${rankStyle.border}`,
                                    color: rankStyle.text,
                                    fontFamily: 'var(--font-mono-data)',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  #{rankStyle.label}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                  {div.division}
                                </span>
                                {isMyDiv && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      background: 'var(--brand-royal)',
                                      color: '#ffffff',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      letterSpacing: '0.04em'
                                    }}
                                  >
                                    Divisi Anda
                                  </span>
                                )}
                              </div>
                              <span
                                className="mono"
                                style={{
                                  fontFamily: 'var(--font-mono-data)',
                                  fontWeight: 700,
                                  fontSize: '13.5px',
                                  color: 'var(--success)'
                                }}
                              >
                                {div.avg} pts
                              </span>
                            </div>
                            {/* Progress indicator */}
                            <div style={{ height: '5px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  background: isMyDiv ? 'linear-gradient(90deg, var(--accent), var(--brand-royal))' : 'var(--brand-sky)',
                                  borderRadius: '3px',
                                  transition: 'width 0.6s ease'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* How to Improve Score Guide */}
                {myScore && (
                  <div className="panel glass-card" style={{ height: 'auto', marginBottom: 0 }}>
                    <div className="panel-header" style={{ marginBottom: '12px' }}>
                      <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} style={{ color: 'var(--accent)' }} /> Aturan Perolehan Skor
                      </h2>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', textAlign: 'left', lineHeight: '1.5' }}>
                      Skor Anda merefleksikan kedisiplinan keamanan siber. Pelajari aksi mitigasi dan penalti risiko berikut:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { action: 'Laporkan Email Phishing (Telegram)', change: '+10 pts', isPositive: true, desc: 'Verifikasi & teruskan indikator ancaman ke SOC Bot' },
                        { action: 'Menang Game "Spot the Fake"', change: '+5 pts', isPositive: true, desc: 'Identifikasi situs phishing tiruan pada sesi latihan' },
                        { action: 'Menyelesaikan Pelatihan Ulang', change: '+10 pts', isPositive: true, desc: 'Modul Teachable Moment setelah intersep simulasi' },
                        { action: 'Terjebak Klik Link Phishing', change: '-20 pts', isPositive: false, desc: 'Mengklik tautan tanpa verifikasi pada simulasi phishing' },
                        { action: 'Membocorkan Kredensial Form', change: '-30 pts', isPositive: false, desc: 'Memasukkan kredensial akun pada portal palsu' },
                      ].map((rule, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '11px 14px',
                            background: '#ffffff',
                            border: '1px solid rgba(144, 202, 249, 0.45)',
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(9, 27, 56, 0.03)',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: rule.isPositive ? 'var(--bg-success)' : 'var(--bg-danger)',
                                border: `1px solid ${rule.isPositive ? 'var(--border-success)' : 'var(--border-danger)'}`,
                                color: rule.isPositive ? 'var(--text-success)' : 'var(--text-danger)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {rule.isPositive ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{rule.action}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{rule.desc}</div>
                            </div>
                          </div>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: rule.isPositive ? 'var(--bg-success)' : 'var(--bg-danger)',
                              border: `1px solid ${rule.isPositive ? 'var(--border-success)' : 'var(--border-danger)'}`,
                              color: rule.isPositive ? 'var(--text-success)' : 'var(--text-danger)',
                              fontFamily: 'var(--font-mono-data)',
                              fontWeight: 800,
                              fontSize: '12.5px',
                              marginLeft: '12px',
                              flexShrink: 0
                            }}
                          >
                            {rule.change}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── SPOT THE FAKE TAB ─────────────────────────────── */}
        {activeTab === 'game' && (
          <div className="panel glass-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {eligibility === null ? (
              <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Memeriksa kelayakan pelatihan...</p>
              </div>
            ) : (
              <>
                {/* 1. BEHAVIORAL LOCK SCREEN: SAFE */}
                {eligibility.eligible === false && eligibility.reason === 'safe' && (
                  <div className="game-lock-screen">
                    <div className="verdict-hero-badge verdict-badge-success" style={{ margin: '0 auto 20px auto' }}>
                      <ShieldCheck size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Status Keamanan Perilaku: Terproteksi</h2>
                    <p className="verdict-subtitle">
                      Skor perilaku Anda saat ini berada dalam zona aman. Pelatihan interaktif &ldquo;Spot the Fake&rdquo; dikhususkan sebagai modul mitigasi bagi personel yang memerlukan peningkatan ketahanan risiko.
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '24px', color: 'var(--success)', fontSize: '13px', fontWeight: 700, marginBottom: '24px' }}>
                      <CheckCircle2 size={15} /> Skor Perilaku: {myScore?.score || 'Safe'} / 100 • Pertahankan Pertahanan Anda
                    </div>
                    <div>
                      <button
                        onClick={() => setActiveTab('quiz')}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px' }}
                      >
                        <BookOpen size={16} /> Ikuti Daily Security Quiz <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. BEHAVIORAL LOCK SCREEN: COOLDOWN */}
                {eligibility && !eligibility.eligible && eligibility.reason === 'cooldown' && (
                  <div className="game-lock-screen">
                    <div className="verdict-hero-badge" style={{ margin: '0 auto 20px auto', background: 'rgba(245, 158, 11, 0.12)', border: '2px solid var(--warning)', color: 'var(--warning)' }}>
                      <Timer size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Periode Jeda Evaluasi (Cooldown)</h2>
                    <p className="verdict-subtitle">
                      Anda telah menyelesaikan sesi pelatihan &ldquo;Spot the Fake&rdquo;. Sistem sedang merekam pembaruan skor perilaku Anda. Sesi evaluasi ulang berikutnya akan terbuka setelah jeda waktu berakhir.
                    </p>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '16px 28px', background: '#f8fafc', border: '1px solid rgba(226, 232, 240, 0.9)', borderRadius: '12px', marginBottom: '20px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Masa Cooldown Tersisa</span>
                      <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-mono-data)', letterSpacing: '2px' }}>
                        {cooldownTime !== null ? formatCooldown(cooldownTime) : '24:00:00'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. ACTIVE GAME SCREEN */}
                {eligibility && eligibility.eligible && gameState === 'playing' && (
                  <div className="active-game-container" style={{ width: '100%', maxWidth: '980px', padding: '12px' }}>
                    <div className="game-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(144, 202, 249, 0.3)', paddingBottom: '16px', marginBottom: '20px' }}>
                      <div>
                        <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-navy)' }}>
                          <Fish size={18} style={{ color: 'var(--accent)' }} /> Pelatihan Mitigasi Risiko: Spot the Fake
                        </h2>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                          Klik bubble point bernomor (<strong>①, ②, ③</strong>) pada masing-masing portal di bawah untuk mengaudit indikator teknis keamanan.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status Personel:</span>
                        <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={11} /> VULNERABLE
                        </span>
                      </div>
                    </div>

                    {/* Interactive Inspection Callout Box */}
                    {activePin ? (
                      <div className="inspect-detail-drawer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(144, 202, 249, 0.3)', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              className={`inspect-pin ${activePin.startsWith('A') ? 'pin-danger' : 'pin-success'} active`}
                              style={{ width: '22px', height: '22px', fontSize: '11px' }}
                            >
                              {activePin.slice(1)}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-navy)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              PORTAL {activePin[0]} • {
                                activePin.endsWith('1') ? 'URL Domain' : activePin.endsWith('2') ? 'Logo & Branding' : 'Hak Cipta & Legalitas'
                              }
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: activePin.startsWith('A') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: activePin.startsWith('A') ? 'var(--danger)' : 'var(--success)',
                                border: `1px solid ${activePin.startsWith('A') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                              }}
                            >
                              {activePin.startsWith('A') ? 'Indikator Mencurigakan (Phishing)' : 'Indikator Otentik (Resmi)'}
                            </span>
                          </div>
                          <button
                            onClick={() => setActivePin(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <X size={14} /> Tutup
                          </button>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '4px' }}>
                            {activePin === 'A1' && "Domain Typo-Squatting & TLD Murah"}
                            {activePin === 'A2' && "Logo Generik Tanpa Sertifikat Integritas"}
                            {activePin === 'A3' && "Hak Cipta Fiktif Tanpa Badan Hukum"}
                            {activePin === 'B1' && "Domain Resmi Berbadan Hukum Indonesia"}
                            {activePin === 'B2' && "Branding Legal Terverifikasi SSO"}
                            {activePin === 'B3' && "Hak Cipta Sah & Standar Enkripsi 256-Bit"}
                          </h4>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                            {activePin === 'A1' && "Domain 'sso.company-portal.xyz' adalah tiruan. Penyerang menambahkan kata '-portal' dan memakai TLD generik '.xyz'. Domain resmi organisasi selalu berakhir dengan '.co.id'."}
                            {activePin === 'A2' && "Logo bertuliskan 'Corporate Portal SSO' adalah template generik tanpa identitas visual resmi dan tanpa tanda checkmark integritas terverifikasi."}
                            {activePin === 'A3' && "Mencantumkan '© 2025 Corporate Portal'. Entitas ini fiktif dan dibuat untuk memanipulasi kepercayaan tanpa adanya pendaftaran badan hukum yang sah."}
                            {activePin === 'B1' && "Domain 'sso.company.co.id' adalah domain resmi organisasi. Domain '.co.id' memerlukan verifikasi legalitas dokumen perusahaan resmi di Indonesia."}
                            {activePin === 'B2' && "Memuat lambang legal 'Corporate Secure SSO' lengkap dengan checkmark integritas sistem yang terdaftar pada infrastruktur korporasi."}
                            {activePin === 'B3' && "Mencantumkan '© 2025 Corporate Organization. Dilindungi oleh Enkripsi SSL 256-bit.' yang mengindikasikan standar kepatuhan hukum resmi."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="inspect-alert" style={{ background: '#ffffff', border: '1.5px dashed rgba(144, 202, 249, 0.8)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(9, 27, 56, 0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Search size={15} style={{ color: 'var(--accent)' }} />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                            <strong>Mode Audit Aktif:</strong> Klik bubble point bernomor (<strong>①, ②, ③</strong>) pada Portal A atau Portal B untuk membedah indikator forensik keamanan.
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, padding: '3px 8px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '6px' }}>
                          6 Titik Audit
                        </span>
                      </div>
                    )}

                    {/* Portals Comparison Grid */}
                    <div className="portals-compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      
                      {/* PORTAL A (FAKE PORTAL) */}
                      <div className="portal-mockup-card" style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px', position: 'relative', border: '1.5px solid rgba(226, 232, 240, 0.9)', color: '#333' }}>
                        <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--brand-navy)', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>PORTAL A</div>
                        
                        {/* Browser Address Bar Mockup with Bubble Pin 1 */}
                        <div
                          className={`inspectable-item-wrapper ${activePin === 'A1' ? 'active-inspected' : ''}`}
                          onClick={() => setActivePin(activePin === 'A1' ? null : 'A1')}
                          style={{ marginBottom: '24px' }}
                        >
                          <div
                            className="browser-address"
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#475569', borderLeft: '3px solid var(--danger)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Lock size={12} style={{ color: '#64748b' }} />
                              <span style={{ fontFamily: 'var(--font-mono-data)', fontSize: '11.5px' }}>https://sso.company-portal.xyz/verify-login</span>
                            </div>
                            <button
                              type="button"
                              className={`inspect-pin pin-danger ${activePin === 'A1' ? 'active' : ''}`}
                              title="Klik untuk inspeksi URL"
                              onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'A1' ? null : 'A1'); }}
                            >
                              1
                            </button>
                          </div>
                        </div>

                        {/* SSO Portal Inner */}
                        <div style={{ maxWidth: '300px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center', position: 'relative' }}>
                          
                          {/* Logo Area with Bubble Pin 2 */}
                          <div
                            className={`inspectable-item-wrapper ${activePin === 'A2' ? 'active-inspected' : ''}`}
                            onClick={() => setActivePin(activePin === 'A2' ? null : 'A2')}
                            style={{ padding: '6px', borderRadius: '8px', marginBottom: '8px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <div
                                className="portal-logo"
                                style={{ display: 'inline-flex', width: '36px', height: '36px', background: '#1e293b', color: 'white', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}
                              >
                                S
                              </div>
                              <button
                                type="button"
                                className={`inspect-pin pin-danger ${activePin === 'A2' ? 'active' : ''}`}
                                style={{ position: 'absolute', right: '10px', top: '-4px' }}
                                title="Klik untuk inspeksi Logo & Branding"
                                onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'A2' ? null : 'A2'); }}
                              >
                                2
                              </button>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginTop: '6px' }}>Corporate Portal SSO</div>
                          </div>
                          
                          <input type="text" disabled placeholder="nama@perusahaan.co.id" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <input type="password" disabled placeholder="Password" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Masuk</button>
                        </div>

                        {/* Footer with Bubble Pin 3 */}
                        <div
                          className={`inspectable-item-wrapper ${activePin === 'A3' ? 'active-inspected' : ''}`}
                          onClick={() => setActivePin(activePin === 'A3' ? null : 'A3')}
                          style={{ marginTop: '24px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                            &copy; 2025 Corporate Portal. Semua hak dilindungi.
                          </span>
                          <button
                            type="button"
                            className={`inspect-pin pin-danger ${activePin === 'A3' ? 'active' : ''}`}
                            title="Klik untuk inspeksi Legalitas Footer"
                            onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'A3' ? null : 'A3'); }}
                          >
                            3
                          </button>
                        </div>
                      </div>

                      {/* PORTAL B (REAL PORTAL) */}
                      <div className="portal-mockup-card" style={{ background: '#f8fafc', borderRadius: '12px', padding: '24px', position: 'relative', border: '1.5px solid rgba(226, 232, 240, 0.9)', color: '#333' }}>
                        <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--brand-navy)', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>PORTAL B</div>

                        {/* Browser Address Bar Mockup with Bubble Pin 1 */}
                        <div
                          className={`inspectable-item-wrapper ${activePin === 'B1' ? 'active-inspected' : ''}`}
                          onClick={() => setActivePin(activePin === 'B1' ? null : 'B1')}
                          style={{ marginBottom: '24px' }}
                        >
                          <div
                            className="browser-address"
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '7px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#475569', borderLeft: '3px solid var(--success)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Lock size={12} style={{ color: 'var(--success)' }} />
                              <span style={{ fontFamily: 'var(--font-mono-data)', fontSize: '11.5px' }}>https://sso.company.co.id/verify-login</span>
                            </div>
                            <button
                              type="button"
                              className={`inspect-pin pin-success ${activePin === 'B1' ? 'active' : ''}`}
                              title="Klik untuk inspeksi URL Resmi"
                              onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'B1' ? null : 'B1'); }}
                            >
                              1
                            </button>
                          </div>
                        </div>

                        {/* SSO Portal Inner */}
                        <div style={{ maxWidth: '300px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center', position: 'relative' }}>
                          
                          {/* Logo Area with Bubble Pin 2 */}
                          <div
                            className={`inspectable-item-wrapper ${activePin === 'B2' ? 'active-inspected' : ''}`}
                            onClick={() => setActivePin(activePin === 'B2' ? null : 'B2')}
                            style={{ padding: '6px', borderRadius: '8px', marginBottom: '8px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <div
                                className="portal-logo"
                                style={{ display: 'inline-flex', width: '36px', height: '36px', background: '#0284c7', color: 'white', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}
                              >
                                S
                              </div>
                              <button
                                type="button"
                                className={`inspect-pin pin-success ${activePin === 'B2' ? 'active' : ''}`}
                                style={{ position: 'absolute', right: '10px', top: '-4px' }}
                                title="Klik untuk inspeksi Logo & Verifikasi"
                                onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'B2' ? null : 'B2'); }}
                              >
                                2
                              </button>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              Corporate Secure SSO <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                            </div>
                          </div>
                          
                          <input type="text" disabled placeholder="nama@perusahaan.co.id" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <input type="password" disabled placeholder="Password" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Masuk</button>
                        </div>

                        {/* Footer with Bubble Pin 3 */}
                        <div
                          className={`inspectable-item-wrapper ${activePin === 'B3' ? 'active-inspected' : ''}`}
                          onClick={() => setActivePin(activePin === 'B3' ? null : 'B3')}
                          style={{ marginTop: '24px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                            &copy; 2025 Corporate Organization. Dilindungi oleh Enkripsi SSL 256-bit.
                          </span>
                          <button
                            type="button"
                            className={`inspect-pin pin-success ${activePin === 'B3' ? 'active' : ''}`}
                            title="Klik untuk inspeksi Legalitas Footer"
                            onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'B3' ? null : 'B3'); }}
                          >
                            3
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Submitting Selection Section */}
                    <div style={{ marginTop: '36px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', letterSpacing: '0.02em' }}>
                        IDENTIFIKASI: PILIH PORTAL MANA YANG MERUPAKAN SITUS PHISHING
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                          className="btn btn-danger"
                          onClick={() => submitAnswer('A')}
                          disabled={isSubmittingEvent}
                          style={{ padding: '12px 28px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <ShieldAlert size={16} /> PORTAL A adalah Phishing
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => submitAnswer('B')}
                          disabled={isSubmittingEvent}
                          style={{ padding: '12px 28px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <ShieldAlert size={16} /> PORTAL B adalah Phishing
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. VERDICT / EDUCATIONAL MOMENT SCREEN */}
                {eligibility && eligibility.eligible && gameState === 'verdict' && (
                  <div className="verdict-educational-moment" style={{ width: '100%', maxWidth: '680px', padding: '16px 0' }}>
                    <div className="verdict-hero-container">
                      {userChoice === 'A' ? (
                        <>
                          <div className="verdict-hero-badge verdict-badge-success">
                            <CheckCircle2 size={42} />
                          </div>
                          <h2 className="verdict-title" style={{ color: 'var(--success)' }}>Verifikasi Akurat — Indikator Phishing Teridentifikasi</h2>
                          <p className="verdict-subtitle">
                            Analisis Anda tepat. <strong>Portal A</strong> adalah portal tiruan phishing. Skor reputasi Anda bertambah <strong>+5 Poin</strong>.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="verdict-hero-badge verdict-badge-danger">
                            <XCircle size={42} />
                          </div>
                          <h2 className="verdict-title" style={{ color: 'var(--danger)' }}>Indikator Terlewat — Taktik Penipuan Tidak Terdeteksi</h2>
                          <p className="verdict-subtitle">
                            Pilihan Anda kurang tepat. <strong>Portal B</strong> adalah SSO resmi organisasi, sedangkan <strong>Portal A</strong> adalah portal phishing.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="threat-breakdown-panel">
                      <div className="threat-breakdown-title">
                        <FileText size={16} style={{ color: 'var(--accent)' }} />
                        <span>Analisis Forensik: Indikator Ancaman Portal A</span>
                      </div>
                      
                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <Globe size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">Indikator 1: Domain Typo-Squatting & TLD Palsu</div>
                          <div className="threat-content-desc">
                            Domain palsu menggunakan <code>sso.company-portal.xyz</code>. Taktik ini menyisipkan kata tambahan <code>-portal</code> dan memakai TLD generik murah <code>.xyz</code>. Domain legal organisasi selalu berakhiran <code>.co.id</code>.
                          </div>
                        </div>
                      </div>

                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <FileWarning size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">Indikator 2: Badan Hukum & Hak Cipta Fiktif</div>
                          <div className="threat-content-desc">
                            Bagian footer Portal A mencantumkan <code>© 2025 Corporate Portal</code>. Ini bukan entitas hukum legal yang terdaftar di database korporasi.
                          </div>
                        </div>
                      </div>

                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <Fingerprint size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">Indikator 3: Ketiadaan Verifikasi Integritas SSO</div>
                          <div className="threat-content-desc">
                            Portal A tidak memuat sertifikasi visual keamanan SSL terverifikasi seperti yang selalu dipasang pada Portal B resmi.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <button
                        onClick={handleFinishVerdict}
                        className="btn btn-primary"
                        style={{ padding: '12px 32px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <span>Saya Mengerti, Kembali ke Dashboard</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {/* ── DAILY QUIZ TAB ────────────────────────────────── */}
      {activeTab === 'quiz' && (
        <div className="panel glass-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {quizLoading ? (
            <div style={{ textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Memuat Kuis Hari Ini...</p>
            </div>
          ) : quizError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <AlertTriangle size={64} style={{ color: 'var(--danger)' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 10px 0' }}>Gagal Memuat Kuis</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px' }}>
                {quizError}
              </p>
              <button
                onClick={fetchDailyQuiz}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Coba Lagi
              </button>
            </div>
          ) : quizQuestion?.completed_today ? (
            <div className="quiz-completed-screen" style={{ textAlign: 'center', padding: '48px 20px', maxWidth: '580px', margin: '0 auto' }}>
              <div className="verdict-hero-badge verdict-badge-success" style={{ margin: '0 auto 20px auto' }}>
                <ShieldCheck size={42} />
              </div>
              <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Kuis Harian Selesai</h2>
              <p className="verdict-subtitle">
                Evaluasi kesadaran keamanan siber Anda hari ini telah tuntas. Pertahankan konsistensi harian untuk memperkuat pertahanan organisasi.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '28px' }}>
                <div style={{ background: '#ffffff', border: '1.5px solid rgba(144, 202, 249, 0.45)', padding: '16px 28px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(9, 27, 56, 0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'var(--font-mono-data)' }}>
                    <Flame size={22} /> {quizQuestion.daily_streak || myScore?.dailyStreak || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: '4px' }}>Streak Kuis (Hari)</div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="btn btn-primary"
                style={{ padding: '12px 32px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Kembali ke Command Center</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : quizQuestion && quizVerdict === 'playing' ? (
            <div className="active-quiz-container" style={{ width: '100%', maxWidth: '680px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(144, 202, 249, 0.3)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-navy)' }}>
                    <BookOpen size={18} style={{ color: 'var(--accent)' }} /> Daily Security Quiz
                  </h2>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Selesaikan 1 kuis harian untuk menjaga streak dan memperoleh <strong>+10 Poin Reputasi</strong>.
                  </p>
                </div>
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {quizQuestion.category} • {quizQuestion.difficulty}
                </span>
              </div>

              <div className="quiz-question-box" style={{ background: '#ffffff', border: '1.5px solid rgba(144, 202, 249, 0.45)', borderRadius: '12px', padding: '22px 24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(9, 27, 56, 0.04)' }}>
                <p style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--brand-navy)', lineHeight: 1.6, margin: 0, textAlign: 'left' }}>
                  {quizQuestion.question_text}
                </p>
              </div>

              <div className="quiz-options-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quizQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitQuizAnswer(idx)}
                    disabled={isSubmittingQuiz}
                    className="quiz-option-btn"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 18px',
                      background: '#ffffff',
                      border: '1px solid rgba(226, 232, 240, 0.9)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(9, 27, 56, 0.02)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.9)';
                    }}
                  >
                    <span style={{ display: 'flex', width: '26px', height: '26px', background: 'rgba(2, 132, 199, 0.08)', color: 'var(--accent)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: '6px', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span style={{ lineHeight: 1.4 }}>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : quizQuestion && quizVerdict === 'verdict' && (
            <div className="quiz-verdict-container" style={{ width: '100%', maxWidth: '640px', padding: '16px 0', textAlign: 'center' }}>
              <div className="verdict-hero-container">
                {quizChoice === quizQuestion.correct_answer_index ? (
                  <>
                    <div className="verdict-hero-badge verdict-badge-success">
                      <CheckCircle2 size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--success)' }}>Jawaban Tepat — Protokol Keamanan Terpenuhi</h2>
                    <p className="verdict-subtitle">
                      Analisis Anda sesuai dengan prosedur keamanan operasional. Poin reputasi Anda bertambah <strong>+10 Poin</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="verdict-hero-badge verdict-badge-danger">
                      <XCircle size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--danger)' }}>Protokol Keliru — Perlu Evaluasi Prosedur</h2>
                    <p className="verdict-subtitle">
                      Pilihan Anda tidak sesuai dengan standar mitigasi risiko siber. Streak harian Anda terhenti.
                    </p>

                    {quizReviveAvailable && quizRevivesRemaining > 0 && (
                      <div className="revive-shield-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 700, fontSize: '14.5px' }}>
                          <Flame size={18} style={{ color: '#f59e0b' }} />
                          <span>Streak Shield Tersedia — Pulihkan Streak {quizStreakBeforeBreak} Hari</span>
                        </div>
                        <p style={{ fontSize: '12.5px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
                          Gunakan 1 Cyber Recovery Token untuk menyelamatkan streak harian Anda sebelum direset permanen. (Sisa: <strong>{quizRevivesRemaining} Token</strong> bulan ini)
                        </p>
                        <button
                          onClick={handleReviveStreak}
                          disabled={isSubmittingRevive}
                          className="revive-btn"
                        >
                          <Sparkles size={16} />
                          <span>{isSubmittingRevive ? 'Mengaktifkan Shield...' : 'Aktivasi Streak Shield'}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="threat-breakdown-panel" style={{ margin: '0 auto 28px auto' }}>
                <div className="threat-breakdown-title">
                  <FileText size={16} style={{ color: 'var(--accent)' }} />
                  <span>Pembahasan & Prosedur Keamanan Operasional</span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--brand-navy)' }}>Pertanyaan:</strong> {quizQuestion.question_text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', color: 'var(--success)', fontWeight: 600, marginBottom: quizChoice !== quizQuestion.correct_answer_index ? '8px' : 0 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>Prosedur Rekomendasi (Jawaban Benar): {quizQuestion.options[quizQuestion.correct_answer_index]}</span>
                  </div>
                  {quizChoice !== quizQuestion.correct_answer_index && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: 'var(--danger)', fontWeight: 600 }}>
                      <XCircle size={16} style={{ flexShrink: 0 }} />
                      <span>Pilihan Anda (Beresiko): {quizQuestion.options[quizChoice as number]}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleFinishQuiz}
                className="btn btn-primary"
                style={{ padding: '12px 32px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Kembali ke Command Center</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        Afferent · Centralized Security Platform · Powered by Behavior Engine
      </footer>
    </div>
  );
}