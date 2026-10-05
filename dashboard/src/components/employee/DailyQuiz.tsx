'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Flame, ShieldCheck, XCircle } from 'lucide-react';
import StateMessage from '@/components/ui/StateMessage';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

interface Question {
  id: number; question_text: string; options: string[]; correct_answer_index: number;
  category: string; difficulty: string; completed_today?: boolean; daily_streak?: number;
  /** Not sent by the API yet. Shown when it is, so the answer can be explained. */
  explanation?: string;
}
type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; question: Question };

interface DailyQuizProps {
  email: string;
  fallbackStreak: number;
  onBack: () => void;
  /** Called once today's answer is saved, so the dashboard can refresh points and the next-step card. */
  onAnswered: () => void;
}

export default function DailyQuiz({ email, fallbackStreak, onBack, onAnswered }: DailyQuizProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [phase, setPhase] = useState<'playing' | 'saving' | 'result'>('playing');
  const [failed, setFailed] = useState(false);
  const [revive, setRevive] = useState<{ available: boolean; remaining: number; streak: number }>({ available: false, remaining: 0, streak: 0 });
  const [reviving, setReviving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/quiz/today?email=${encodeURIComponent(email)}`)
      .then(async res => ({ ok: res.ok, body: await res.json().catch(() => ({})) }))
      .then(({ ok, body }) => { if (active) setLoad(ok ? { state: 'ready', question: body } : { state: 'error', message: typeof body.error === 'string' ? body.error : '' }); })
      .catch(() => { if (active) setLoad({ state: 'error', message: '' }); });
    return () => { active = false; };
  }, [email, attempt]);

  const retry = () => { setLoad({ state: 'loading' }); setAttempt(n => n + 1); };

  async function submit(question: Question) {
    if (choice === null || phase === 'saving') return;
    setPhase('saving'); setFailed(false);
    try {
      const res = await fetch('/api/quiz/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: email, question_id: question.id, selected_option_index: choice }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      setRevive({ available: Boolean(data.revive_available), remaining: data.revives_remaining || 0, streak: data.streak_before_break || 0 });
      setPhase('result'); onAnswered();
    } catch { setPhase('playing'); setFailed(true); }
  }

  async function restoreStreak() {
    setReviving(true);
    try {
      const res = await fetch('/api/quiz/revive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: email }) });
      if (!res.ok) throw new Error();
      toast.show({ message: t('quiz.revive.ok'), tone: 'ok' });
      setRevive(r => ({ ...r, available: false })); onAnswered();
    } catch { toast.show({ message: t('quiz.revive.fail'), tone: 'bad' }); }
    finally { setReviving(false); }
  }

  const level = (value: string) => { const key = `quiz.level.${value.toLowerCase()}` as MessageKey; return ['easy', 'medium', 'hard'].includes(value.toLowerCase()) ? t(key) : value; };
  const category = (value: string) => (value.toLowerCase() === 'phishing' ? t('quiz.cat.phishing') : value.charAt(0).toUpperCase() + value.slice(1));

  return (
    <div className="game-wrap">
      <button type="button" className="btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t('quiz.back')}</button>
      <section className="emp-card game-card quiz-card" aria-labelledby="quiz-title">
        <h2 id="quiz-title">{t('quiz.title')}</h2>
        {load.state === 'loading' && <StateMessage variant="loading" title={t('quiz.loading')} lines={4} />}
        {load.state === 'error' && <StateMessage variant="error" title={t('quiz.error.title')} why={load.message || undefined} action={{ label: t('common.retry'), onClick: retry }} />}

        {load.state === 'ready' && load.question.completed_today && (
          <div className="game-lock">
            <ShieldCheck size={32} aria-hidden="true" />
            <h3>{t('quiz.done.title')}</h3><p>{t('quiz.done.body')}</p>
            <p className="quiz-streak"><Flame size={16} aria-hidden="true" />{t('quiz.streak', { days: load.question.daily_streak || fallbackStreak })}</p>
            <button type="button" className="btn btn-primary" onClick={onBack}>{t('quiz.back')}</button>
          </div>
        )}

        {load.state === 'ready' && !load.question.completed_today && phase !== 'result' && (() => {
          const question = load.question;
          return <>
            <p className="game-intro">{t('quiz.intro')} <span className="quiz-tags">{category(question.category)} · {level(question.difficulty)}</span></p>
            <div role="group" aria-labelledby="quiz-question" className="quiz-block">
              <h3 id="quiz-question" className="quiz-question">{question.question_text}</h3>
              <p className="emp-muted">{t('quiz.choose')}</p>
              <div className="quiz-options">
                {question.options.map((option, index) => (
                  <button key={index} type="button" className="quiz-option" aria-pressed={choice === index} disabled={phase === 'saving'} onClick={() => setChoice(index)}>
                    <span className="quiz-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span>
                  </button>
                ))}
              </div>
              {failed && <p className="debt-error" role="alert">{t('quiz.fail')}</p>}
              <button type="button" className="btn btn-primary" disabled={choice === null || phase === 'saving'} onClick={() => void submit(question)}>{phase === 'saving' ? t('quiz.submitting') : t('quiz.submit')}</button>
            </div>
          </>;
        })()}

        {load.state === 'ready' && phase === 'result' && choice !== null && (() => {
          const question = load.question; const right = choice === question.correct_answer_index;
          return (
            <div className="game-result" role="status">
              <div className="game-result-head" data-correct={right}>
                {right ? <CheckCircle2 size={28} aria-hidden="true" /> : <XCircle size={28} aria-hidden="true" />}
                <div><h3>{t(right ? 'quiz.correct.title' : 'quiz.wrong.title')}</h3><p>{t(right ? 'quiz.correct.body' : 'quiz.wrong.body')}</p></div>
              </div>
              <div className="quiz-answers">
                <p><CheckCircle2 size={16} aria-hidden="true" />{t('quiz.correctAnswer', { answer: question.options[question.correct_answer_index] })}</p>
                {!right && <p><XCircle size={16} aria-hidden="true" />{t('quiz.yourAnswer', { answer: question.options[choice] })}</p>}
                {question.explanation && <p className="quiz-why"><strong>{t('quiz.explanation')}</strong>{question.explanation}</p>}
              </div>
              {!right && revive.available && revive.remaining > 0 && (
                <div className="quiz-revive">
                  <strong><Flame size={16} aria-hidden="true" />{t('quiz.revive.title', { days: revive.streak })}</strong>
                  <span>{t('quiz.revive.body', { n: revive.remaining })}</span>
                  <button type="button" className="btn" disabled={reviving} onClick={() => void restoreStreak()}>{reviving ? t('quiz.revive.working') : t('quiz.revive.action')}</button>
                </div>
              )}
              <button type="button" className="btn btn-primary" onClick={onBack}>{t('quiz.back')}</button>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
