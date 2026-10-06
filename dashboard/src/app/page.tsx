'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { useCallback, useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import AccountMenu from '@/components/AccountMenu';
import NotificationBell from '@/components/NotificationBell';
import EmployeeHome, { type DivisionAverage, type EmployeeActivity, type EmployeeScore } from '@/components/employee/EmployeeHome';
import TrainingPicker from '@/components/employee/TrainingPicker';
import SpotTheFake from '@/components/employee/SpotTheFake';
import DailyQuiz from '@/components/employee/DailyQuiz';
import { useI18n } from '@/i18n/I18nProvider';
import './dashboard.css';
import './employee.css';

/* ── Types matching API responses ─────────────────────────── */
interface BehaviorScore extends EmployeeScore {
  userId: string; risk: string; reason: string; trainingCompleted: number;
}

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  soc: '/dashboard/soc',
  ciso: '/dashboard/ciso',
  grc: '/dashboard/grc',
  phishing_admin: '/dashboard/phishing-admin',
};

export default function EmployeeDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'game' | 'quiz'>('dashboard');
  const [trainingOpen, setTrainingOpen] = useState(false);

  const behaviorUrl = user ? `/api/behavior?email=${encodeURIComponent(user.email)}` : '';
  const { data: behaviorData, isLoading: behaviorLoading, error: behaviorError, refresh: refreshBehavior } =
    usePolling<{ scores: BehaviorScore[]; by_divisi?: { division: string; avg: number }[] }>(behaviorUrl, 5000);
  const [activities, setActivities] = useState<EmployeeActivity[]>([]);
  const [activitiesError, setActivitiesError] = useState(false);
  // null while unknown. A failed check leaves it unknown and never claims "done".
  const [quizDone, setQuizDone] = useState<boolean | null>(null);

  const loadActivities = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user-activity?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setActivitiesError(false);
      } else setActivitiesError(true);
    } catch { setActivitiesError(true); }
  }, [user]);

  // Refresh the activity list and today's quiz status whenever the person returns to the dashboard.
  useEffect(() => {
    if (!user || activeTab !== 'dashboard') return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActivities();
    fetch(`/api/quiz/today?email=${encodeURIComponent(user.email)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (active && data) setQuizDone(Boolean(data.completed_today)); })
      .catch(() => {});
    return () => { active = false; };
  }, [user, activeTab, loadActivities]);

  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Logo size={48} variant="mark" logoAnimation="loading" />
        <p>{t('emp.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) redirect('/auth');
  if (user.role && ROLE_ROUTES[user.role]) redirect(ROLE_ROUTES[user.role]);

  const scores = behaviorData?.scores || [];
  const myScore = scores.find(s => s.email === user.email);

  const divisionAverages: DivisionAverage[] = behaviorData?.by_divisi
    ? behaviorData.by_divisi.map(d => ({ division: d.division, avg: d.avg })).sort((a, b) => b.avg - a.avg)
    : Object.entries(
        scores.reduce((acc, curr) => {
          (acc[curr.division] ||= []).push(curr.score);
          return acc;
        }, {} as Record<string, number[]>)
      ).map(([division, list]) => ({ division, avg: Math.round(list.reduce((a, b) => a + b, 0) / list.length) }))
       .sort((a, b) => b.avg - a.avg);

  return (
    <div className="app emp-page">
      <header className="emp-top">
        <span className="brand"><Logo variant="mark" size={28} />AFFERENT</span>
        <span className="emp-top-tools">
          <LanguageSwitch />
          <ThemeToggle />
          <NotificationBell role="employee" />
          <AccountMenu />
        </span>
      </header>

      <main className="main">
        {activeTab === 'dashboard' && (
          <div className="emp-wrap">
            <EmployeeHome
              name={user.userName || ''}
              email={user.email}
              myScore={myScore}
              scoreLoading={behaviorLoading}
              scoreError={Boolean(behaviorError)}
              onRetryScore={refreshBehavior}
              activities={activities}
              activitiesError={activitiesError}
              divisionAverages={divisionAverages}
              quizDone={quizDone}
              onOpenTraining={() => setTrainingOpen(true)}
              onStartQuiz={() => setActiveTab('quiz')}
              onReportComplete={refreshBehavior}
            />
          </div>
        )}

        {activeTab === 'game' && (
          <SpotTheFake
            email={user.email}
            division={user.division}
            onBack={() => setActiveTab('dashboard')}
            onTakeQuiz={() => setActiveTab('quiz')}
            onScored={refreshBehavior}
          />
        )}

        {activeTab === 'quiz' && (
          <DailyQuiz
            email={user.email}
            fallbackStreak={myScore?.dailyStreak || 0}
            onBack={() => setActiveTab('dashboard')}
            onAnswered={() => { setQuizDone(true); refreshBehavior(); }}
          />
        )}
      </main>

      <TrainingPicker
        open={trainingOpen}
        onClose={() => setTrainingOpen(false)}
        onChoose={choice => { setTrainingOpen(false); setActiveTab(choice === 'game' ? 'game' : 'quiz'); }}
      />

      <footer className="dashboard-footer">AFFERENT · Team security</footer>
    </div>
  );
}
