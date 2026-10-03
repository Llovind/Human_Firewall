'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { useCallback, useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import ReportingBadgesWidget from '@/components/ReportingBadgesWidget';
import ProxyConnectionCard from '@/components/ProxyConnectionCard';
import EmployeeUrlScanner from '@/components/EmployeeUrlScanner';
import AccountMenu from '@/components/AccountMenu';
import { 
  Fish, Shield, ShieldCheck, Timer, Lightbulb, Search,
  Flame, BookOpen, Star, FileWarning, CheckCircle2, AlertTriangle, Trophy, 
  Flag, Info, XCircle, Sparkles, Globe, Lock, ShieldAlert,
  ArrowRight, X, FileText, Fingerprint,
  Gamepad2, ArrowLeft
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
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

/* ── Formatting Helpers ───────────────────────────────────── */
const eventLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  clicked_link: { label: 'Clicked a phishing link', icon: <Fish size={14} />, color: 'var(--danger)' },
  submitted_data: { label: 'Submitted a simulation form', icon: <FileWarning size={14} />, color: 'var(--danger)' },
  viewed_training: { label: 'Completed retraining', icon: <CheckCircle2 size={14} />, color: 'var(--success)' },
  skipped_training: { label: 'Skipped retraining', icon: <AlertTriangle size={14} />, color: 'var(--warning)' },
  phishing_click: { label: 'Clicked a simulation link', icon: <Fish size={14} />, color: 'var(--danger)' },
  spot_the_fake_correct: { label: 'Spot the Fake completed (+5 pts)', icon: <Trophy size={14} />, color: 'var(--success)' },
  spot_the_fake_incorrect: { label: 'Spot the Fake — review needed', icon: <AlertTriangle size={14} />, color: 'var(--warning)' },
  report_malicious: { label: 'Confirmed threat report (+15 pts)', icon: <ShieldCheck size={14} />, color: 'var(--text-success)' },
  report_safe: { label: 'Reported a safe URL/file', icon: <CheckCircle2 size={14} />, color: 'var(--accent)' },
  daily_quiz_completed: { label: 'Daily quiz completed (+10 pts)', icon: <Flame size={14} />, color: 'var(--text-warning)' },
  quiz_completed: { label: 'Daily quiz completed (+10 pts)', icon: <Flame size={14} />, color: 'var(--text-warning)' },
};

export default function EmployeeDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'game' | 'quiz'>('dashboard');
  const [gameModalOpen, setGameModalOpen] = useState(false);

  // ── Polling & state data sources ───
  const behaviorUrl = user 
    ? `/api/behavior?email=${encodeURIComponent(user.email)}`
    : '';
  const { data: behaviorData, hasUpdated: behaviorUpdated, refresh: pollBehavior } = usePolling<{ scores: BehaviorScore[]; by_divisi?: { division: string; avg: number }[] }>(behaviorUrl, 5000);
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

  const fetchDailyQuiz = useCallback(async () => {
    if (!user) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const res = await fetch(`/api/quiz/today?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setQuizQuestion(data);
      } else {
        const errData = await res.json();
        setQuizError(errData.error || 'Could not load the daily quiz.');
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setQuizError('Could not reach the server.');
    } finally {
      setQuizLoading(false);
    }
  }, [user]);

  const submitQuizAnswer = async (choiceIndex: number) => {
    if (!user || !quizQuestion || isSubmittingQuiz) return;
    setIsSubmittingQuiz(true);
    setQuizChoice(choiceIndex);

    try {
      const res = await fetch('/api/quiz/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: user.email,
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
        alert('Could not submit quiz status.');
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      alert('Could not record the quiz.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleReviveStreak = async () => {
    if (!user || isSubmittingRevive) return;
    setIsSubmittingRevive(true);

    try {
      const res = await fetch('/api/quiz/revive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: user.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert('Your streak has been restored.');
        setQuizReviveAvailable(false);
        setQuizQuestion(prev => prev ? { ...prev, daily_streak: data.daily_streak, completed_today: true } : null);
        setQuizVerdict('playing');
        pollBehavior();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Could not restore your streak.');
      }
    } catch (err) {
      console.error('Error reviving streak:', err);
      alert('Could not reach the server.');
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
      // Loading/error state belongs to this network request, not derived UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDailyQuiz();
    }
  }, [activeTab, quizQuestion, fetchDailyQuiz]);

  // ── Clock ───
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Fetch User Activities & Eligibility ───
  const loadUserActivities = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user-activity?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, [user]);

  const checkEligibility = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user-eligibility?email=${encodeURIComponent(user.email)}`);
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
  }, [user]);

  useEffect(() => {
    if (user) {
      // Synchronize activity from the backend on authenticated tab transitions.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUserActivities();
      checkEligibility();
    }
  }, [user, activeTab, loadUserActivities, checkEligibility]);

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
  }, [cooldownTime, checkEligibility]);

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
        alert('Could not submit your answer.');
      }
    } catch {
      alert('Could not record your training result.');
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
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    redirect('/auth');
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
      redirect(roleRoutes[user.role]);
    }
  }

  const scores = behaviorData?.scores || [];
  const myScore = scores.find(s => s.email === user.email);

  // Calculate division averages and rankings
  const divisionAverages = behaviorData?.by_divisi 
    ? behaviorData.by_divisi.map(d => ({ division: d.division, avg: d.avg })).sort((a, b) => b.avg - a.avg)
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
    "Never share your password or OTP, even with an administrator.",
    "Check the sender and destination domain before clicking.",
    "Enable multi-factor authentication on work accounts.",
    "Watch for double file extensions, such as report.pdf.exe.",
    "Report suspicious emails to your SOC team."
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
        </div>
        <div className="topbar-right">
          <button
            onClick={() => setGameModalOpen(true)}
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              background: 'rgba(33, 150, 243, 0.12)',
              border: '1px solid var(--border-active)',
              borderRadius: '6px',
              color: 'var(--accent)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              marginRight: '8px',
            }}
          >
            <Gamepad2 size={15} /> Security training
          </button>
          <div className="live-indicator">
            <span className="live-dot" />
            <span>Employee</span>
          </div>
          <span className="clock mono">{clock}</span>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="main">
        {/* ── MY DASHBOARD TAB ─────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            <header className="employee-intro">
              <div><h1>Hi, {user.userName || 'there'}.</h1><p>Check links, track your score, and keep learning.</p></div>
              <a className="btn" href="/blocked?domain=blocked.afferent.test" target="_blank" rel="noopener noreferrer"><ShieldAlert size={15} />Preview block page</a>
            </header>
            <ProxyConnectionCard />
            <EmployeeUrlScanner onReportComplete={pollBehavior} />
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
                      <div className="score-ring-container" title="Security points (0–200)">
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
                          <span className="mini-stat-label">Company rank</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><ShieldCheck size={14} /></span>
                          <span className="mini-stat-value">{myScore.streak} weeks</span>
                          <span className="mini-stat-label">Click-free</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Star size={14} /></span>
                          <span className="mini-stat-value">{myScore.score}%</span>
                          <span className="mini-stat-label">Security score</span>
                        </div>
                        <div className="mini-stat">
                          <span className="mini-stat-icon"><Flame size={14} /></span>
                          <span className="mini-stat-value">{myScore.dailyStreak || 0} days</span>
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
                    <button
                      onClick={() => setGameModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '11px 16px',
                        borderRadius: '8px',
                        marginTop: '16px',
                        width: '100%',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.25)',
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <Gamepad2 size={16} /> Security training
                    </button>
                  </div>
                ) : (
                  <div className="panel glass-card" style={{ height: 'auto' }}>
                    Loading your score…
                  </div>
                )}

                {/* Achievements Showcase (Combined Widget) */}
                {myScore && (
                  <ReportingBadgesWidget email={user.email} legacyBadges={myScore.badges || []} />
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
                        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Today’s security tip</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                          &ldquo;{currentTip}&rdquo;
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
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> Security activity</h2>
                    <span className="panel-count">{activities.length} aktivitas</span>
                  </div>
                   <div style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '8px', paddingBottom: '24px' }} className="timeline-scroll-container">
                    <div className="timeline" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '32px', borderLeft: '2px solid var(--border)', marginLeft: '16px' }}>
                      {activities.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '-32px' }}>No security activity yet.</p>
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
                                  Aktivitas AFFERENT.{' '}
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
                      <Trophy size={18} style={{ color: 'var(--accent)' }} /> Division leaderboard
                    </h2>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono-data)', color: 'var(--text-muted)' }}>Top 5</span>
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
                          Your division <strong>{myScore.division}</strong> ranks <strong>#{myDivRank}</strong> of <strong>{divisionAverages.length}</strong> divisions, averaging <strong style={{ color: 'var(--brand-royal)' }}>{divisionAverages[myDivRankIdx]?.avg} pts</strong>.
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
                              background: isMyDiv ? 'var(--bg-elevated)' : 'var(--bg-surface)',
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
                                    Your division
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
                        <ShieldCheck size={18} style={{ color: 'var(--accent)' }} /> Points guide
                      </h2>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', textAlign: 'left', lineHeight: '1.5' }}>
                      Earn points through training and eligible reports.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { action: 'Report a malicious URL', change: '+15 pts', isPositive: true, desc: 'Confirmed, unique reports · up to 3 rewards per day' },
                        { action: 'Complete Spot the Fake', change: '+5 pts', isPositive: true, desc: 'Identify the phishing page in training' },
                        { action: 'Complete retraining', change: '+10 pts', isPositive: true, desc: 'Complete the post-simulation lesson' },
                        { action: 'Click a phishing link', change: '-20 pts', isPositive: false, desc: 'Click an unverified simulation link' },
                        { action: 'Submit a phishing form', change: '-30 pts', isPositive: false, desc: 'Submit the simulation form' },
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={16} /> Back to dashboard
              </button>
            </div>
            <div className="panel glass-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {eligibility === null ? (
              <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Checking training availability…</p>
              </div>
            ) : (
              <>
                {/* 1. BEHAVIORAL LOCK SCREEN: SAFE */}
                {eligibility.eligible === false && eligibility.reason === 'safe' && (
                  <div className="game-lock-screen">
                    <div className="verdict-hero-badge verdict-badge-success" style={{ margin: '0 auto 20px auto' }}>
                      <ShieldCheck size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Your score is in the safe range</h2>
                    <p className="verdict-subtitle">
                      Spot the Fake is currently reserved for employees who need additional practice. You can still take the daily quiz.
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '24px', color: 'var(--success)', fontSize: '13px', fontWeight: 700, marginBottom: '24px' }}>
                      <CheckCircle2 size={15} /> Behavior score: {myScore?.score || 'Safe'} / 100 · Keep learning
                    </div>
                    <div>
                      <button
                        onClick={() => setActiveTab('quiz')}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px' }}
                      >
                        <BookOpen size={16} /> Take the daily quiz <ArrowRight size={15} />
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
                    <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Training cooldown</h2>
                    <p className="verdict-subtitle">
                      Your session is complete. Return when the cooldown ends to try again.
                    </p>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '16px 28px', background: '#f8fafc', border: '1px solid rgba(226, 232, 240, 0.9)', borderRadius: '12px', marginBottom: '20px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Time remaining</span>
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
                          <Fish size={18} style={{ color: 'var(--accent)' }} /> Spot the Fake
                        </h2>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                          Select the numbered markers (<strong>①, ②, ③</strong>) to compare each page.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Training status:</span>
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
                              {activePin.startsWith('A') ? 'Suspicious indicator' : 'Expected indicator'}
                            </span>
                          </div>
                          <button
                            onClick={() => setActivePin(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <X size={14} /> Close
                          </button>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '4px' }}>
                            {activePin === 'A1' && "Domain Typo-Squatting & TLD Murah"}
                            {activePin === 'A2' && "Unfamiliar branding"}
                            {activePin === 'A3' && "Unfamiliar footer"}
                            {activePin === 'B1' && "Domain Resmi Berbadan Hukum Indonesia"}
                            {activePin === 'B2' && "Branding Legal Terverifikasi SSO"}
                            {activePin === 'B3' && "Expected footer"}
                          </h4>
                          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                            {activePin === 'A1' && "In this exercise, 'sso.company-portal.xyz' imitates the expected 'company.co.id' domain. A TLD alone does not prove phishing."}
                            {activePin === 'A2' && "The branding differs from the known portal. Logos can be copied; verify the domain first."}
                            {activePin === 'A3' && "The footer differs from the known portal. Treat it as a clue, not proof on its own."}
                            {activePin === 'B1' && "Domain 'sso.company.co.id' adalah domain resmi organisasi. Domain '.co.id' memerlukan verifikasi legalitas dokumen perusahaan resmi di Indonesia."}
                            {activePin === 'B2' && "This matches the expected branding in this exercise. A badge alone cannot verify a website."}
                            {activePin === 'B3' && "The footer matches the example portal. Encryption claims are not proof that a site is legitimate."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="inspect-alert" style={{ background: '#ffffff', border: '1.5px dashed rgba(144, 202, 249, 0.8)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(9, 27, 56, 0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Search size={15} style={{ color: 'var(--accent)' }} />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                            <strong>Compare pages:</strong> Select a numbered marker (<strong>①, ②, ③</strong>) on either portal.
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
                              title="Inspect URL"
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
                                title="Inspect branding"
                                onClick={(e) => { e.stopPropagation(); setActivePin(activePin === 'A2' ? null : 'A2'); }}
                              >
                                2
                              </button>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e', marginTop: '6px' }}>Corporate Portal SSO</div>
                          </div>
                          
                          <input type="text" disabled placeholder="nama@perusahaan.co.id" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <input type="password" disabled placeholder="Password" style={{ width: '100%', padding: '8px', margin: '6px 0', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                          <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Sign in</button>
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
                            title="Inspect footer"
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
                              title="Inspect expected URL"
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
                                title="Inspect branding"
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
                          <button type="button" disabled style={{ width: '100%', padding: '8px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>Sign in</button>
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
                            title="Inspect footer"
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
                          <ShieldAlert size={16} /> Portal A is phishing
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => submitAnswer('B')}
                          disabled={isSubmittingEvent}
                          style={{ padding: '12px 28px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <ShieldAlert size={16} /> Portal B is phishing
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
                          <h2 className="verdict-title" style={{ color: 'var(--success)' }}>Correct — you spotted the phishing page</h2>
                          <p className="verdict-subtitle">
                            <strong>Portal A</strong> is the phishing page. You earned <strong>+5 points</strong>.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="verdict-hero-badge verdict-badge-danger">
                            <XCircle size={42} />
                          </div>
                          <h2 className="verdict-title" style={{ color: 'var(--danger)' }}>Not quite — review the clues</h2>
                          <p className="verdict-subtitle">
                            <strong>Portal B</strong> is the expected SSO page in this exercise. <strong>Portal A</strong> is phishing.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="threat-breakdown-panel">
                      <div className="threat-breakdown-title">
                        <FileText size={16} style={{ color: 'var(--accent)' }} />
                        <span>Why Portal A is phishing</span>
                      </div>
                      
                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <Globe size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">1. Lookalike domain</div>
                          <div className="threat-content-desc">
                            The domain <code>sso.company-portal.xyz</code> differs from the expected <code>company.co.id</code>. Check the full domain; a TLD alone is not a threat verdict.
                          </div>
                        </div>
                      </div>

                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <FileWarning size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">2. Different footer</div>
                          <div className="threat-content-desc">
                            The footer uses <code>© 2025 Corporate Portal</code>, rather than the known organization name. This is a supporting clue, not standalone proof.
                          </div>
                        </div>
                      </div>

                      <div className="threat-indicator-card">
                        <div className="threat-icon-box">
                          <Fingerprint size={16} />
                        </div>
                        <div>
                          <div className="threat-content-title">3. Different branding</div>
                          <div className="threat-content-desc">
                            The branding differs from the expected portal. Logos, badges, and encryption claims can be copied.
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
                        <span>Saya Mengerti, Back to dashboard</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
      )}

      {/* ── DAILY QUIZ TAB ────────────────────────────────── */}
      {activeTab === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} /> Back to dashboard
            </button>
          </div>
          <div className="panel glass-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {quizLoading ? (
            <div style={{ textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading today’s quiz…</p>
            </div>
          ) : quizError ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <AlertTriangle size={64} style={{ color: 'var(--danger)' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 10px 0' }}>Could not load the quiz</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px auto', fontSize: '14px' }}>
                {quizError}
              </p>
              <button
                onClick={fetchDailyQuiz}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Try again
              </button>
            </div>
          ) : quizQuestion?.completed_today ? (
            <div className="quiz-completed-screen" style={{ textAlign: 'center', padding: '48px 20px', maxWidth: '580px', margin: '0 auto' }}>
              <div className="verdict-hero-badge verdict-badge-success" style={{ margin: '0 auto 20px auto' }}>
                <ShieldCheck size={42} />
              </div>
              <h2 className="verdict-title" style={{ color: 'var(--brand-navy)' }}>Daily quiz complete</h2>
              <p className="verdict-subtitle">
                You’re done for today. Come back tomorrow to keep learning.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '28px' }}>
                <div style={{ background: '#ffffff', border: '1.5px solid rgba(144, 202, 249, 0.45)', padding: '16px 28px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(9, 27, 56, 0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'var(--font-mono-data)' }}>
                    <Flame size={22} /> {quizQuestion.daily_streak || myScore?.dailyStreak || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: '4px' }}>Quiz streak (days)</div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="btn btn-primary"
                style={{ padding: '12px 32px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Back to dashboard</span>
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
                    Complete today’s quiz to keep your streak and earn <strong>+10 points</strong>.
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
                    <h2 className="verdict-title" style={{ color: 'var(--success)' }}>Correct answer</h2>
                    <p className="verdict-subtitle">
                      You earned <strong>+10 points</strong>. Review the explanation below.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="verdict-hero-badge verdict-badge-danger">
                      <XCircle size={42} />
                    </div>
                    <h2 className="verdict-title" style={{ color: 'var(--danger)' }}>Review this answer</h2>
                    <p className="verdict-subtitle">
                      That answer was incorrect. Your daily streak has ended.
                    </p>

                    {quizReviveAvailable && quizRevivesRemaining > 0 && (
                      <div className="revive-shield-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 700, fontSize: '14.5px' }}>
                          <Flame size={18} style={{ color: '#f59e0b' }} />
                          <span>Restore your {quizStreakBeforeBreak}-day streak</span>
                        </div>
                        <p style={{ fontSize: '12.5px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
                          Use one recovery token to restore your streak. <strong>{quizRevivesRemaining}</strong> remaining this month.
                        </p>
                        <button
                          onClick={handleReviveStreak}
                          disabled={isSubmittingRevive}
                          className="revive-btn"
                        >
                          <Sparkles size={16} />
                          <span>{isSubmittingRevive ? 'Activating shield…' : 'Aktivasi Streak Shield'}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="threat-breakdown-panel" style={{ margin: '0 auto 28px auto' }}>
                <div className="threat-breakdown-title">
                  <FileText size={16} style={{ color: 'var(--accent)' }} />
                  <span>Answer explanation</span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--brand-navy)' }}>Question:</strong> {quizQuestion.question_text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', color: 'var(--success)', fontWeight: 600, marginBottom: quizChoice !== quizQuestion.correct_answer_index ? '8px' : 0 }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>Correct answer: {quizQuestion.options[quizQuestion.correct_answer_index]}</span>
                  </div>
                  {quizChoice !== quizQuestion.correct_answer_index && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: 'var(--danger)', fontWeight: 600 }}>
                      <XCircle size={16} style={{ flexShrink: 0 }} />
                      <span>Your answer: {quizQuestion.options[quizChoice as number]}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleFinishQuiz}
                className="btn btn-primary"
                style={{ padding: '12px 32px', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Back to dashboard</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      )}
      </main>

      {/* ── Minigames Selection Modal ──────────────────────── */}
      {gameModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setGameModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Choose your training
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                  Practice spotting threats and earn security points.
                </p>
              </div>
              <button
                onClick={() => setGameModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Option 1: Spot the Fake */}
              <div
                onClick={() => {
                  setGameModalOpen(false);
                  setActiveTab('game');
                }}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(33, 150, 243, 0.15)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Fish size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Spot the Fake
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    Compare two login pages and find the phishing attempt.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>+5 points per win</span>
                  <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>Start training →</span>
                </div>
              </div>

              {/* Option 2: Daily Cyber Quiz */}
              <div
                onClick={() => {
                  setGameModalOpen(false);
                  setActiveTab('quiz');
                }}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ea580c';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(234, 88, 12, 0.15)',
                    color: '#ea580c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Daily Cyber Quiz
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    One security question a day. Answer correctly to keep your streak.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>+10 Pts + Streak</span>
                  <span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>Today’s quiz →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        AFFERENT · Team security
      </footer>
    </div>
  );
}
