'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Award, CheckCircle2, ChevronRight, Flame, Shield, ShieldCheck, Trophy } from 'lucide-react';
import ProxyConnectionCard, { type ProxyReport } from '@/components/ProxyConnectionCard';
import EmployeeUrlScanner from '@/components/EmployeeUrlScanner';
import ReportingBadgesWidget from '@/components/ReportingBadgesWidget';
import Dialog from '@/components/ui/Dialog';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/hooks/useNow';
import { usePolling } from '@/hooks/usePolling';
import { usePreference } from '@/hooks/usePreference';
import { formatAgo } from '@/lib/relativeTime';
import type { MessageKey } from '@/i18n/messages';

export interface EmployeeScore {
  userName: string; email: string; division: string;
  score: number; streak: number; dailyStreak?: number; rank: number; totalPoints: number; badges: string[];
}
export interface EmployeeActivity { event_type: string; created_at: string; campaign_id: string | null }
export interface DivisionAverage { division: string; avg: number }

interface EmployeeHomeProps {
  name: string;
  email: string;
  myScore: EmployeeScore | undefined;
  scoreLoading: boolean;
  scoreError: boolean;
  onRetryScore: () => void;
  activities: EmployeeActivity[];
  activitiesError: boolean;
  divisionAverages: DivisionAverage[];
  /** null while unknown. */
  quizDone: boolean | null;
  onOpenTraining: () => void;
  onStartQuiz: () => void;
  onReportComplete: () => void;
}

const MAX_POINTS = 200;
const EVENTS: Record<string, { key: MessageKey; tone: 'ok' | 'bad' | 'warn' | 'neutral' }> = {
  clicked_link: { key: 'act.clicked_link', tone: 'bad' },
  phishing_click: { key: 'act.clicked_link', tone: 'bad' },
  submitted_data: { key: 'act.submitted_data', tone: 'bad' },
  viewed_training: { key: 'act.viewed_training', tone: 'ok' },
  skipped_training: { key: 'act.skipped_training', tone: 'warn' },
  spot_the_fake_correct: { key: 'act.spot_correct', tone: 'ok' },
  spot_the_fake_incorrect: { key: 'act.spot_incorrect', tone: 'warn' },
  report_malicious: { key: 'act.report_malicious', tone: 'ok' },
  report_safe: { key: 'act.report_safe', tone: 'neutral' },
  daily_quiz_completed: { key: 'act.quiz', tone: 'ok' },
  quiz_completed: { key: 'act.quiz', tone: 'ok' },
};
const RULES: { key: MessageKey; desc: MessageKey; points: number }[] = [
  { key: 'pts.report', desc: 'pts.report.desc', points: 15 },
  { key: 'pts.spot', desc: 'pts.spot.desc', points: 5 },
  { key: 'pts.retrain', desc: 'pts.retrain.desc', points: 10 },
  { key: 'pts.click', desc: 'pts.click.desc', points: -20 },
  { key: 'pts.submit', desc: 'pts.submit.desc', points: -30 },
];

function range(points: number): { key: MessageKey; tone: 'ok' | 'warn' | 'bad' } {
  if (points >= 130) return { key: 'emp.safety.range.safe', tone: 'ok' };
  if (points >= 60) return { key: 'emp.safety.range.watch', tone: 'warn' };
  return { key: 'emp.safety.range.risk', tone: 'bad' };
}

function ScoreRing({ points }: { points: number }) {
  const radius = 42; const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, points / MAX_POINTS));
  const tone = range(points).tone;
  const color = tone === 'ok' ? 'var(--sev-ok)' : tone === 'warn' ? 'var(--sev-medium)' : 'var(--sev-critical)';
  return (
    <svg className="emp-ring" viewBox="0 0 100 100" role="img" aria-label={`${points} / ${MAX_POINTS}`}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${fraction * circumference} ${circumference}`} transform="rotate(-90 50 50)" />
    </svg>
  );
}

interface MyRequest { id: string; domain: string; status: 'open' | 'allowed' | 'denied'; decision_note: string | null; created_at: string }
const REQUEST_TONE = { open: 'open', allowed: 'ok', denied: 'neutral' } as const;
const REQUEST_LABEL: Record<MyRequest['status'], MessageKey> = { open: 'req.status.open', allowed: 'req.status.allowed', denied: 'req.status.denied' };
const REQUEST_HINT: Record<MyRequest['status'], MessageKey> = { open: 'myreq.open.hint', allowed: 'myreq.allowed.hint', denied: 'myreq.denied.hint' };

export default function EmployeeHome(props: EmployeeHomeProps) {
  const { name, email, myScore, scoreLoading, scoreError, onRetryScore, activities, activitiesError, divisionAverages, quizDone, onOpenTraining, onStartQuiz, onReportComplete } = props;
  const { t, lang } = useI18n();
  const now = useNow();
  const [proxy, setProxy] = useState<ProxyReport | null>(null);
  const [dialog, setDialog] = useState<null | 'points' | 'badges' | 'activity'>(null);
  const { data: requestData, error: requestError } = usePolling<{ requests: MyRequest[] }>('/api/access-requests', 30000);
  const myRequests = requestData?.requests ?? [];
  // In-app notice: answered requests stay on top until the person dismisses them (remembered in this browser).
  const [seenRaw, setSeen] = usePreference('afferent_seen_requests', '');
  const seen = useMemo(() => new Set(seenRaw.split(',').filter(Boolean)), [seenRaw]);
  const unseen = myRequests.filter(item => item.status !== 'open' && !seen.has(item.id)).slice(0, 3);
  const dismiss = (id: string) => setSeen([...seen, id].slice(-50).join(','));
  const onProxy = useCallback((report: ProxyReport) => setProxy(report), []);

  const protectionOn = proxy?.connected === true;
  const protectionUnknown = proxy === null || (proxy.checking && !proxy.failed);
  const step: 'protect' | 'quiz' | 'done' | 'unknown' =
    protectionUnknown ? 'unknown' : !protectionOn ? 'protect' : quizDone === null ? 'unknown' : quizDone ? 'done' : 'quiz';

  const goToProtection = () => document.getElementById('protection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const shown = activities.slice(0, 5);
  const myDivIndex = myScore ? divisionAverages.findIndex(d => d.division === myScore.division) : -1;
  const maxAvg = divisionAverages[0]?.avg || MAX_POINTS;
  const myRange = myScore ? range(myScore.totalPoints || 0) : null;

  const renderActivity = (items: EmployeeActivity[]) => (
    <ul className="emp-list">
      {items.map((act, i) => {
        const meta = EVENTS[act.event_type] ?? { key: 'act.unknown' as MessageKey, tone: 'neutral' as const };
        return (
          <li key={`${act.event_type}-${act.created_at}-${i}`}>
            <span className="emp-dot" data-tone={meta.tone} aria-hidden="true" />
            <span className="emp-list-main">
              {t(meta.key)}
              {act.campaign_id && <small>{t('act.campaign', { id: act.campaign_id })}</small>}
            </span>
            <time className="emp-list-time">{formatAgo(act.created_at, lang, now)}</time>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="emp-home">
      <h1 className="emp-greeting">{t('emp.greeting', { name: (name || '').split(' ')[0] || '' }).replace(/\s+\./, '.')} <span className="wave" aria-hidden="true">👋</span></h1>

      {unseen.length > 0 && (
        <section className="emp-notices" aria-label={t('notice.request.title')} role="status">
          {unseen.map(item => (
            <div key={item.id} className="emp-notice" data-status={item.status}>
              <div>
                <strong>{t('notice.request.title')}</strong>
                <span><span className="mono">{item.domain}</span> <StatusChip tone={REQUEST_TONE[item.status]}>{t(REQUEST_LABEL[item.status])}</StatusChip></span>
                {item.decision_note && <small>{t('req.decision.note')}: {item.decision_note}</small>}
              </div>
              <button type="button" className="btn" onClick={() => dismiss(item.id)}>{t('notice.dismiss')}</button>
            </div>
          ))}
        </section>
      )}

      {/* Next step: one clear thing to do */}
      <section className="emp-next" aria-live="polite" data-step={step}>
        {step === 'unknown' && <StateMessage variant="loading" lines={2} compact />}
        {step === 'protect' && <>
          <div><span className="emp-eyebrow">{t('emp.next.eyebrow')}</span><h2>{t('emp.next.protect.title')}</h2><p>{t('emp.next.protect.body')}</p></div>
          <button type="button" className="btn btn-primary" onClick={goToProtection}>{t('emp.next.protect.action')}<ArrowRight size={16} aria-hidden="true" /></button>
        </>}
        {step === 'quiz' && <>
          <div><span className="emp-eyebrow">{t('emp.next.eyebrow')}</span><h2>{t('emp.next.quiz.title')}</h2><p>{t('emp.next.quiz.body')}</p></div>
          <button type="button" className="btn btn-primary" onClick={onStartQuiz}>{t('emp.next.quiz.action')}<ArrowRight size={16} aria-hidden="true" /></button>
        </>}
        {step === 'done' && <>
          <div><span className="emp-eyebrow"><CheckCircle2 size={14} aria-hidden="true" /> {t('emp.next.eyebrow')}</span><h2>{t('emp.next.done.title')}</h2><p>{t('emp.next.done.body')}</p></div>
          <button type="button" className="btn" onClick={onOpenTraining}>{t('emp.next.done.action')}</button>
        </>}
      </section>

      {/* Device protection: open until it works, then tucked away */}
      <details className="emp-protect" id="protection" data-on={protectionOn} open={!protectionOn}>
        <summary><ShieldCheck size={16} aria-hidden="true" />{t('emp.protect.on')}<span>{t('emp.protect.details')}</span></summary>
        <ProxyConnectionCard onStatus={onProxy} />
      </details>

      <div className="emp-grid">
        {/* My safety */}
        <section className="emp-card" aria-labelledby="emp-safety">
          <h2 id="emp-safety">{t('emp.safety.title')}</h2>
          {scoreLoading && !myScore && <StateMessage variant="loading" title={t('emp.scoreLoading')} lines={3} />}
          {scoreError && !myScore && !scoreLoading && <StateMessage variant="error" title={t('emp.scoreError.title')} why={t('emp.scoreError.why')} action={{ label: t('common.retry'), onClick: onRetryScore }} compact />}
          {myScore && myRange && <>
            <div className="emp-score">
              <div className="emp-ring-wrap"><ScoreRing points={myScore.totalPoints || 0} /><span className="emp-ring-num">{myScore.totalPoints}</span></div>
              <div className="emp-score-text">
                <span className="emp-points">{t('emp.safety.points', { max: MAX_POINTS })}</span>
                <StatusChip tone={myRange.tone}>{t(myRange.key)}</StatusChip>
                <ul className="emp-facts">
                  <li><Flame size={14} aria-hidden="true" />{t('emp.safety.streak', { days: myScore.dailyStreak || 0 })}</li>
                  <li><ShieldCheck size={14} aria-hidden="true" />{t('emp.clickfree', { weeks: myScore.streak })}</li>
                  <li><Trophy size={14} aria-hidden="true" />{t('emp.safety.rank', { rank: myScore.rank })}</li>
                </ul>
              </div>
            </div>
            <div className="emp-badges">
              <span className="emp-label">{t('emp.safety.badges')}</span>
              {(myScore.badges || []).length === 0
                ? <span className="emp-muted">{t('emp.safety.noBadges')}</span>
                : <span className="emp-chips">{myScore.badges.map(b => <span key={b} className="emp-chip"><Award size={12} aria-hidden="true" />{b}</span>)}</span>}
            </div>
            <div className="emp-card-actions">
              <button type="button" className="btn" onClick={onOpenTraining}><Shield size={16} aria-hidden="true" />{t('emp.training.open')}</button>
              <button type="button" className="emp-link" onClick={() => setDialog('badges')}>{t('emp.badges.see')}<ChevronRight size={14} aria-hidden="true" /></button>
              <button type="button" className="emp-link" onClick={() => setDialog('points')}>{t('emp.safety.howPoints')}<ChevronRight size={14} aria-hidden="true" /></button>
            </div>
          </>}
        </section>

        {/* My activity */}
        <section className="emp-card" aria-labelledby="emp-activity">
          <div className="emp-card-head"><h2 id="emp-activity">{t('emp.activity.title')}</h2>{activities.length > 5 && <button type="button" className="emp-link" onClick={() => setDialog('activity')}>{t('common.viewAll')}<ChevronRight size={14} aria-hidden="true" /></button>}</div>
          {activitiesError && activities.length === 0
            ? <StateMessage variant="error" title={t('emp.activity.error')} compact />
            : activities.length === 0
              ? <StateMessage variant="empty" title={t('emp.activity.empty.title')} why={t('emp.activity.empty.body')} compact />
              : renderActivity(shown)}
        </section>
      </div>

      {/* Check or report */}
      <EmployeeUrlScanner onReportComplete={onReportComplete} />

      {/* My access requests: shown only once the person has asked for something */}
      {(myRequests.length > 0 || (requestError && !requestData)) && (
        <section className="emp-card" aria-labelledby="emp-requests">
          <h2 id="emp-requests">{t('myreq.title')}</h2>
          {requestError && !requestData
            ? <StateMessage variant="error" title={t('myreq.error')} compact />
            : <ul className="emp-list">
                {myRequests.slice(0, 5).map(item => (
                  <li key={item.id}>
                    <span className="emp-list-main">
                      <span className="mono">{item.domain}</span>
                      <small>{item.decision_note ? `${t('req.decision.note')}: ${item.decision_note}` : t(REQUEST_HINT[item.status])}</small>
                    </span>
                    <StatusChip tone={REQUEST_TONE[item.status]}>{t(REQUEST_LABEL[item.status])}</StatusChip>
                    <time className="emp-list-time">{formatAgo(item.created_at, lang, now)}</time>
                  </li>
                ))}
              </ul>}
        </section>
      )}

      {/* Division leaderboard */}
      {divisionAverages.length > 0 && (
        <section className="emp-card" aria-labelledby="emp-board">
          <h2 id="emp-board">{t('emp.board.title')}</h2>
          {myScore && myDivIndex >= 0 && <p className="emp-muted">{t('emp.board.rank', { rank: myDivIndex + 1, total: divisionAverages.length, avg: divisionAverages[myDivIndex].avg })}</p>}
          <ol className="emp-board">
            {divisionAverages.slice(0, 5).map((div, index) => {
              const mine = div.division === myScore?.division;
              return (
                <li key={div.division} data-mine={mine || undefined}>
                  <span className="emp-rank">{index + 1}</span>
                  <span className="emp-board-name">{div.division}{mine && <em>{t('emp.board.yours')}</em>}</span>
                  <span className="emp-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(6, Math.round((div.avg / maxAvg) * 100)))}%` }} /></span>
                  <span className="emp-board-pts">{t('pts.unit', { n: div.avg })}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <Dialog open={dialog === 'points'} onClose={() => setDialog(null)} title={t('pts.title')} description={t('pts.intro')}>
        <ul className="emp-rules">
          {RULES.map(rule => (
            <li key={rule.key}>
              <span><strong>{t(rule.key)}</strong><small>{t(rule.desc)}</small></span>
              <span className="emp-rule-pts" data-sign={rule.points > 0 ? 'plus' : 'minus'}>{rule.points > 0 ? '+' : '−'}{t('pts.unit', { n: Math.abs(rule.points) })}</span>
            </li>
          ))}
        </ul>
      </Dialog>
      <Dialog open={dialog === 'badges'} onClose={() => setDialog(null)} title={t('emp.badges.title')} size="lg">
        <ReportingBadgesWidget email={email} legacyBadges={myScore?.badges || []} />
      </Dialog>
      <Dialog open={dialog === 'activity'} onClose={() => setDialog(null)} title={t('emp.activity.title')}>
        <div className="emp-scroll">{renderActivity(activities)}</div>
      </Dialog>
    </div>
  );
}
