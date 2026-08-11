'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { useEffect, useState } from 'react';
import Logo from '@/components/Logo';
import ReportingBadgesWidget from '@/components/ReportingBadgesWidget';
import { LayoutDashboard, Fish, Shield, ShieldCheck, Timer, Lightbulb, Search, Flame, BookOpen, Star, FileWarning, CheckCircle2, AlertTriangle, Trophy, Flag } from 'lucide-react';
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
  report_malicious: { label: 'Melaporkan Ancaman Berbahaya (+15 pts)', icon: <ShieldCheck size={14} />, color: '#10b981' },
  report_safe: { label: 'Melaporkan URL/File Aman', icon: <CheckCircle2 size={14} />, color: '#06b6d4' },
  daily_quiz_completed: { label: 'Kuis Harian Selesai & Streak Nambah (+10 pts)', icon: <Flame size={14} />, color: '#e8a33d' },
  quiz_completed: { label: 'Kuis Harian Selesai & Streak Nambah (+10 pts)', icon: <Flame size={14} />, color: '#e8a33d' },
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
  const [inspectItem, setInspectItem] = useState<{ title: string; desc: string } | null>(null);
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
      const storedToken = user.token || new URLSearchParams(window.location.search).get('token');
      if (!storedToken) {
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return;
      }
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
      const storedToken = user.token || new URLSearchParams(window.location.search).get('token');
      
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
      const storedToken = user.token || new URLSearchParams(window.location.search).get('token');
      
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
      const storedToken = user.token || new URLSearchParams(window.location.search).get('token');
      if (!storedToken) {
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return;
      }
      
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
      const storedToken = user.token || new URLSearchParams(window.location.search).get('token');
      if (!storedToken) {
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return;
      }
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
    setInspectItem(null);
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

  if (user.role === 'admin') {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin';
    }
    return null;
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
            href="/blocked?url=https://portal-keuangan-infranexia.xyz/login&source=URLScan&score=94&type=Credential%20Harvesting"
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
                        {myScore.risk === 'low' ? '✅ SECURE' : myScore.risk === 'medium' ? '⚠️ MEDIUM RISK' : '🚨 CRITICAL RISK'}
                      </span>
                    </div>
                    <div className="my-score-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '24px 0' }}>
                      <div className="score-ring-container">
                        <svg className="score-ring" viewBox="0 0 120 120" style={{ width: '150px', height: '150px' }}>
                          <circle className="score-ring-bg" cx="60" cy="60" r="52" />
                          <circle
                            className="score-ring-fill"
                            cx="60" cy="60" r="52"
                            style={{
                              strokeDasharray: `${(myScore.score / 100) * 326.73} 326.73`,
                              stroke: myScore.score >= 70 ? 'var(--success)' : myScore.score >= 40 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          />
                        </svg>
                        <div className="score-ring-value">
                          <span className="score-number" style={{ fontSize: '32px' }}>{myScore.score}</span>
                          <span className="score-label">Risk Rating</span>
                        </div>
                      </div>
                      <div className="my-score-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Trophy size={14} /></span>
                          <span className="mini-stat-value">#{myScore.rank}</span>
                          <span className="mini-stat-label">Rank</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><ShieldCheck size={14} /></span>
                          <span className="mini-stat-value">{myScore.streak} minggu</span>
                          <span className="mini-stat-label">Bebas Klik</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Star size={14} /></span>
                          <span className="mini-stat-value">{myScore.totalPoints} pts</span>
                          <span className="mini-stat-label">Points</span>
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
                              <span className="timeline-dot" style={{ position: 'absolute', left: '-41px', top: '2px', background: details.color, border: '4px solid var(--bg-surface)', width: '16px', height: '16px', borderRadius: '50%', boxShadow: `0 0 8px ${details.color}` }} />
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
                  <div className="panel-header">
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={18} /> Peringkat Kompetisi Divisi</h2>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    {myScore && myDivRank && (
                      <div style={{
                        background: 'rgba(148, 163, 184, 0.05)',
                        border: '1px dashed var(--border)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        textAlign: 'left'
                      }}>
                        IT Security Alert: Divisi Anda <strong>{myScore.division}</strong> saat ini berada di peringkat <strong>#{myDivRank}</strong> dari <strong>{divisionAverages.length}</strong> divisi dengan rata-rata <strong>{divisionAverages[myDivRankIdx]?.avg} pts</strong>.
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {divisionAverages.slice(0, 3).map((div, idx) => (
                        <div key={div.division} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: div.division === myScore?.division ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: div.division === myScore?.division ? '1px solid var(--accent-dim)' : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}>
                          <span style={{ fontWeight: 600, textAlign: 'left', flex: 1, paddingRight: '8px' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {div.division}
                            {div.division === myScore?.division && ' (Divisi Anda)'}
                          </span>
                          <span className="mono" style={{ color: 'var(--success)', fontWeight: 600, flexShrink: 0 }}>{div.avg} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* How to Improve Score Guide */}
                {myScore && (
                  <div className="panel glass-card" style={{ height: 'auto', marginBottom: 0 }}>
                    <div className="panel-header">
                      <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} /> Bagaimana Cara Menaikkan Skor?</h2>
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'left', lineHeight: '1.4' }}>
                        Skor Anda mencerminkan tingkat kewaspadaan siber Anda. Ikuti aturan di bawah ini untuk meningkatkan skor:
                      </p>
                      {[
                        { action: 'Laporkan Email Phishing (Telegram)', change: '+10', color: 'var(--success)', desc: 'Melalui tombol Lapor di Bot' },
                        { action: 'Menang Game "Spot the Fake"', change: '+5', color: 'var(--success)', desc: 'Identifikasi situs phishing tiruan' },
                        { action: 'Menyelesaikan Pelatihan Ulang', change: '+10', color: 'var(--success)', desc: 'Modul pelatihan setelah klik simulasi' },
                        { action: 'Terjebak Klik Link Phishing', change: '-20', color: 'var(--danger)', desc: 'Simulasi phishing bulanan' },
                        { action: 'Membocorkan Kredensial Form', change: '-30', color: 'var(--danger)', desc: 'Memasukkan sandi pada form palsu' },
                      ].map((rule, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rule.action}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{rule.desc}</div>
                          </div>
                          <span className="mono" style={{ color: rule.color, fontWeight: 700, fontSize: '14px', marginLeft: '12px', flexShrink: 0 }}>{rule.change}</span>
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
              <div className="game-lock-screen" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <ShieldCheck size={64} style={{ color: 'var(--success)' }} />
                <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 10px 0' }}>🛡️ Skor Perilaku Anda Sudah Aman!</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: 1.6 }}>
                  Saat ini skor perilaku Anda berada di zona aman. Latihan "Spot the Fake" dikhususkan untuk rekan-rekan yang perlu meningkatkan skor mereka. Anda tidak wajib mengikuti latihan ini — mari pertahankan performa hebat Anda dan tetap ikuti kuis harian di Daily Quiz!
                </p>
                <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(52,211,153,0.1)', border: '1px solid var(--success)', borderRadius: '20px', color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                  Skor Perilaku Anda: {myScore?.score || 'Safe'} / 100 (Pertahankan!)
                </div>
              </div>
            )}

            {/* 2. BEHAVIORAL LOCK SCREEN: COOLDOWN */}
            {eligibility && !eligibility.eligible && eligibility.reason === 'cooldown' && (
              <div className="game-lock-screen" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Timer size={64} style={{ color: 'var(--warning)' }} />
                <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 10px 0' }}>Pelatihan Selesai Hari Ini</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: 1.6 }}>
                  Anda sudah mengambil latihan "Spot the Fake" hari ini.
                  Untuk mencegah <em>point farming</em> dan memastikan efektivitas belajar, game dibatasi <strong>sekali sehari</strong>.
                </p>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Masa cooldown tersisa:</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning)', fontFamily: 'monospace', letterSpacing: '2px' }}>
                  {cooldownTime !== null ? formatCooldown(cooldownTime) : '24:00:00'}
                </div>
              </div>
            )}

            {/* 3. ACTIVE GAME SCREEN */}
            {eligibility && eligibility.eligible && gameState === 'playing' && (
              <div className="active-game-container">
                <div className="game-header-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                  <div>
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Fish size={18} /> Pelatihan Retraining: Spot the Fake</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Salah satu portal di bawah ini adalah portal pancingan (**Phishing**). Satu lagi adalah **Real SSO** PT Infranexia. 
                      Arahkan kursor Anda ke area tertentu untuk memeriksa kejanggalan.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status Kelayakan:</span>
                    <span className="badge badge-danger">VULNERABLE</span>
                  </div>
                </div>

                {/* Inspect Info Alert Box */}
                <div className="inspect-alert" style={{ background: 'rgba(99,102,241,0.05)', border: '1px dashed var(--accent)', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', minHeight: '62px', display: 'flex', alignItems: 'center' }}>
                  {inspectItem ? (
                    <div>
                      <strong style={{ color: 'var(--accent)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><Search size={14} /> {inspectItem.title}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{inspectItem.desc}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><Lightbulb size={14} /> Gerakkan kursor (hover) di atas elemen portal di bawah untuk menginspeksi keamanan.</span>
                  )}
                </div>

                {/* Portals Comparison Grid */}
                <div className="portals-compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  
                  {/* PORTAL A (FAKE PORTAL) */}
                  <div className="portal-mockup-card" style={{ background: '#f0f2f5', borderRadius: '12px', padding: '24px', position: 'relative', border: '1px solid rgba(0,0,0,0.1)', color: '#333' }}>
                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--bg-elevated)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>PORTAL A</div>
                    
                    {/* Browser Address Bar Mockup */}
                    <div className="browser-address"
                      onMouseEnter={() => setInspectItem({
                        title: "Url Address Bar Portal A",
                        desc: "Domain: 'sso.infranexia-portal.xyz'. Ini domain palsu! Domain resmi Infranexia berakhir dengan '.co.id'. Ekstensi '.xyz' dan nama domain gabungan adalah ciri khas taktik typo-squatting phishing."
                      })}
                      onMouseLeave={() => setInspectItem(null)}
                      style={{ background: '#fff', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#666', marginBottom: '24px', cursor: 'help', borderLeft: '3px solid var(--danger)' }}
                    >
                      <span>🔒</span> <span style={{ fontFamily: 'monospace' }}>https://sso.infranexia-portal.xyz/verify-login</span>
                    </div>

                    {/* SSO Portal Inner */}
                    <div style={{ maxWidth: '300px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                      <div className="portal-logo"
                        onMouseEnter={() => setInspectItem({
                          title: "Brand Logo Portal A",
                          desc: "Tulisan: 'Corporate Portal SSO'. Logo Generik. Logo resmi PT Infranexia harusnya memuat nama dan lambang legal Infranexia Secure."
                        })}
                        onMouseLeave={() => setInspectItem(null)}
                        style={{ display: 'inline-flex', width: '36px', height: '36px', background: '#283593', color: 'white', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', fontWeight: 'bold', fontSize: '18px', cursor: 'help' }}
                      >
                        S
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '16px' }}>Corporate Portal SSO</div>
                      
                      <input type="text" disabled placeholder="nama@perusahaan.co.id" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                      <input type="password" disabled placeholder="Password" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                      <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#283593', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Masuk</button>
                    </div>

                    {/* Footer */}
                    <div className="portal-footer-mock"
                      onMouseEnter={() => setInspectItem({
                        title: "Copyright Footer Portal A",
                        desc: "Mencantumkan: '© 2025 Corporate Portal'. Generic copyright! Corporate Portal bukan entitas hukum legal PT Infranexia."
                      })}
                      onMouseLeave={() => setInspectItem(null)}
                      style={{ fontSize: '10px', textAlign: 'center', color: '#888', marginTop: '24px', cursor: 'help' }}
                    >
                      &copy; 2025 Corporate Portal. Semua hak dilindungi.
                    </div>
                  </div>

                  {/* PORTAL B (REAL PORTAL) */}
                  <div className="portal-mockup-card" style={{ background: '#f0f2f5', borderRadius: '12px', padding: '24px', position: 'relative', border: '1px solid rgba(0,0,0,0.1)', color: '#333' }}>
                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--bg-elevated)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>PORTAL B</div>

                    {/* Browser Address Bar Mockup */}
                    <div className="browser-address"
                      onMouseEnter={() => setInspectItem({
                        title: "Url Address Bar Portal B",
                        desc: "Domain: 'sso.infranexia.co.id'. Ini domain resmi PT Infranexia! Berakhir dengan ekstensi '.co.id' yang membutuhkan verifikasi badan usaha legal Indonesia."
                      })}
                      onMouseLeave={() => setInspectItem(null)}
                      style={{ background: '#fff', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#666', marginBottom: '24px', cursor: 'help', borderLeft: '3px solid var(--success)' }}
                    >
                      <span>🔒</span> <span style={{ fontFamily: 'monospace' }}>https://sso.infranexia.co.id/verify-login</span>
                    </div>

                    {/* SSO Portal Inner */}
                    <div style={{ maxWidth: '300px', margin: '0 auto', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                      <div className="portal-logo"
                        onMouseEnter={() => setInspectItem({
                          title: "Brand Logo Portal B",
                          desc: "Lambang resmi dengan nama: 'Infranexia Secure SSO' dengan checkmark hijau yang terverifikasi."
                        })}
                        onMouseLeave={() => setInspectItem(null)}
                        style={{ display: 'inline-flex', width: '36px', height: '36px', background: '#283593', color: 'white', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', fontWeight: 'bold', fontSize: '18px', cursor: 'help' }}
                      >
                        S
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        Infranexia Secure SSO <span style={{ color: '#34d399', fontSize: '12px' }}>✓</span>
                      </div>
                      
                      <input type="text" disabled placeholder="nama@perusahaan.co.id" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                      <input type="password" disabled placeholder="Password" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} />
                      <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#283593', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Masuk</button>
                    </div>

                    {/* Footer */}
                    <div className="portal-footer-mock"
                      onMouseEnter={() => setInspectItem({
                        title: "Copyright Footer Portal B",
                        desc: "Copyright resmi PT Infranexia, mencantumkan teks: '© 2025 PT Infranexia. Dilindungi oleh Enkripsi SSL 256-bit.' yang mengindikasikan standar sekuriti legal."
                      })}
                      onMouseLeave={() => setInspectItem(null)}
                      style={{ fontSize: '10px', textAlign: 'center', color: '#888', marginTop: '24px', cursor: 'help' }}
                    >
                      &copy; 2025 PT Infranexia. Dilindungi oleh Enkripsi SSL 256-bit.
                    </div>
                  </div>
                </div>

                {/* Submitting Selection Section */}
                <div style={{ marginTop: '36px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>PILIH MANA PORTAL YANG PALSU (PHISHING):</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      className="btn-select-fake"
                      onClick={() => submitAnswer('A')}
                      disabled={isSubmittingEvent}
                      style={{ background: 'var(--danger)', border: 'none', color: 'white', padding: '12px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(248,113,113,0.3)' }}
                    >
                      PORTAL A adalah Palsu
                    </button>
                    <button
                      className="btn-select-fake"
                      onClick={() => submitAnswer('B')}
                      disabled={isSubmittingEvent}
                      style={{ background: 'var(--danger)', border: 'none', color: 'white', padding: '12px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(248,113,113,0.3)' }}
                    >
                      PORTAL B adalah Palsu
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. VERDICT / EDUCATIONAL MOMENT SCREEN */}
            {eligibility && eligibility.eligible && gameState === 'verdict' && (
              <div className="verdict-educational-moment" style={{ padding: '20px 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  {userChoice === 'A' ? (
                    <>
                      <span style={{ fontSize: '64px' }}>🎉</span>
                      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', marginTop: '16px' }}>Benar! Jawaban Anda Tepat!</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                        Portal A adalah portal <strong>Phishing</strong> palsu. Poin Anda bertambah <strong>+5 poin</strong>!
                      </p>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '64px' }}>❌</span>
                      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)', marginTop: '16px' }}>Salah! Tebakan Anda Kurang Tepat</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                        Portal B adalah portal <strong>SSO Resmi Infranexia</strong>. Portal A-lah yang palsu.
                      </p>
                    </>
                  )}
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '600px', margin: '0 auto 32px auto' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    📖 Bedah Taktik: Mengapa Portal A Palsu?
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>🚨</span>
                      <div>
                        <strong>Indikator 1: Nama Domain</strong><br />
                        Domain palsu menggunakan `sso.infranexia-portal.xyz`. Tambahan kata `-portal` dan domain akhiran `.xyz` adalah taktik penipuan. Domain resmi menggunakan `sso.infranexia.co.id`.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>🚨</span>
                      <div>
                        <strong>Indikator 2: Copyright Generik</strong><br />
                        Bagian footer Portal A menuliskan `© 2025 Corporate Portal`. Ini menunjukkan domain tidak terafiliasi resmi dengan PT Infranexia secara legal.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>🚨</span>
                      <div>
                        <strong>Indikator 3: Judul & Branding Portal</strong><br />
                        Portal A memuat `Corporate Portal SSO` tanpa identifikasi visual resmi dari Infranexia (tidak ada verifikasi checkmark hijau seperti Portal B).
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleFinishVerdict}
                    style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '12px 36px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                  >
                    Saya Mengerti, Kembali ke Dashboard
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
            <div className="quiz-completed-screen" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ display: 'inline-flex', width: '80px', height: '80px', background: 'rgba(52,211,153,0.1)', border: '2px solid var(--success)', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                <ShieldCheck size={48} style={{ color: 'var(--success)' }} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0' }}>Kuis Hari Ini Selesai!</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px', lineHeight: 1.6 }}>
                Anda sudah menyelesaikan kuis harian untuk hari ini. Bagus sekali! Pertahankan konsistensi Anda untuk menjaga streak dan poin reputasi tetap prima.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '12px 24px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Flame size={20} /> {quizQuestion.daily_streak || myScore?.dailyStreak || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Streak Kuis (Hari)</div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 36px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Kembali ke Dashboard
              </button>
            </div>
          ) : quizQuestion && quizVerdict === 'playing' ? (
            <div className="active-quiz-container" style={{ width: '100%', maxWidth: '650px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={18} /> Daily Security Quiz</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Selesaikan 1 kuis harian untuk menjaga streak dan mendapatkan <strong>+10 poin reputasi</strong>.
                  </p>
                </div>
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                  {quizQuestion.category} • {quizQuestion.difficulty}
                </span>
              </div>

              <div className="quiz-question-box" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, textAlign: 'left' }}>
                  {quizQuestion.question_text}
                </p>
              </div>

              <div className="quiz-options-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quizQuestion.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitQuizAnswer(idx)}
                    disabled={isSubmittingQuiz}
                    className="quiz-option-btn"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '16px 20px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span style={{ display: 'flex', width: '24px', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : quizQuestion && quizVerdict === 'verdict' && (
            <div className="quiz-verdict-container" style={{ width: '100%', maxWidth: '600px', padding: '24px', textAlign: 'center' }}>
              {quizChoice === quizQuestion.correct_answer_index ? (
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '64px' }}>🎉</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', marginTop: '16px' }}>Jawaban Anda Benar!</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                    Bagus sekali! Anda berhasil menjawab dengan benar. Poin reputasi Anda bertambah <strong>+10 poin</strong>!
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '64px' }}>❌</span>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)', marginTop: '16px' }}>Jawaban Anda Kurang Tepat</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', marginBottom: '20px' }}>
                    Sayang sekali tebakan Anda salah. Streak Anda telah di-reset ke 0.
                  </p>

                  {quizReviveAvailable && quizRevivesRemaining > 0 && (
                    <div style={{
                      background: 'rgba(251, 191, 36, 0.05)',
                      border: '1px solid rgba(251, 191, 36, 0.2)',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      maxWidth: '450px',
                      margin: '0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontWeight: 600, fontSize: '14px' }}>
                        <Flame size={18} /> Streak {quizStreakBeforeBreak} hari kamu putus!
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        Hidupkan kembali streak Anda? (Sisa {quizRevivesRemaining} kesempatan bulan ini)
                      </p>
                      <button
                        onClick={handleReviveStreak}
                        disabled={isSubmittingRevive}
                        style={{
                          background: 'var(--warning)',
                          border: 'none',
                          color: '#1a1a2e',
                          padding: '8px 24px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSubmittingRevive ? 'Memulihkan...' : '✨ Gunakan Revive Token'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', margin: '0 auto 32px auto', textAlign: 'left' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📖 Pembahasan Jawaban
                </h3>
                <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  <p style={{ marginBottom: '8px' }}>
                    <strong>Pertanyaan:</strong> {quizQuestion.question_text}
                  </p>
                  <p style={{ margin: 0, padding: '10px 14px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '6px', color: 'var(--success)', fontWeight: 600 }}>
                    ✓ Jawaban Benar: {quizQuestion.options[quizQuestion.correct_answer_index]}
                  </p>
                  {quizChoice !== quizQuestion.correct_answer_index && (
                    <p style={{ marginTop: '8px', margin: 0, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', color: '#ef4444' }}>
                      ✗ Pilihan Anda: {quizQuestion.options[quizChoice as number]}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleFinishQuiz}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '12px 36px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Kembali ke Dashboard
              </button>
            </div>
          )}
        </div>
      )}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        Human Firewall · Centralized Security Platform · Powered by Behavior Engine
      </footer>
    </div>
  );
}