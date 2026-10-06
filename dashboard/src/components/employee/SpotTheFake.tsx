'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, ShieldCheck, Timer, XCircle } from 'lucide-react';
import StateMessage from '@/components/ui/StateMessage';
import Confetti from '@/components/ui/Confetti';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

interface Eligibility { eligible: boolean; reason?: 'safe' | 'cooldown'; cooldown_seconds?: number }
type Side = 'A' | 'B';
type Pin = 1 | 2 | 3;

interface SpotTheFakeProps {
  email: string;
  division: string;
  onBack: () => void;
  onTakeQuiz: () => void;
  /** Called after a result was saved, so the dashboard can refresh points. */
  onScored: () => void;
}

const FAKE = { address: 'sso.company-portal.xyz', url: 'https://sso.company-portal.xyz/verify-login' };
const REAL = { address: 'sso.company.co.id', url: 'https://sso.company.co.id/verify-login' };
const PIN_KEY: Record<Pin, MessageKey> = { 1: 'game.pin.1', 2: 'game.pin.2', 3: 'game.pin.3' };

function formatCooldown(seconds: number): string {
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

/**
 * A fake sign-in page next to a real one. The numbered markers look the same on both pages until the
 * person answers, and which page is fake is random each time, so neither colour nor position gives it away.
 */
function Portal({ name, kind, active, onPin }: { name: Side; kind: 'fake' | 'real'; active: Pin | null; onPin: (pin: Pin) => void }) {
  const { t } = useI18n();
  const data = kind === 'fake' ? FAKE : REAL;
  const pin = (n: Pin) => (
    <button type="button" className="game-pin" aria-pressed={active === n} aria-label={`${n}. ${t('game.compare.marker', { detail: t(PIN_KEY[n]), name })}`} onClick={() => onPin(n)}>{n}</button>
  );
  return (
    <section className="game-portal" aria-label={t('game.page', { name })}>
      <h3 className="game-portal-name">{t('game.page', { name })}</h3>
      <div className="fake-browser" aria-hidden={false}>
        <div className="fake-address"><Lock size={12} aria-hidden="true" /><span className="mono">{data.url}</span>{pin(1)}</div>
        <div className="fake-card">
          <div className="fake-logo-row"><span className="fake-logo" aria-hidden="true">S</span>{pin(2)}</div>
          <div className="fake-title">{t(kind === 'fake' ? 'game.portal.fake.name' : 'game.portal.real.name')}</div>
          <div className="fake-input">{t('game.portal.email')}</div>
          <div className="fake-input">{t('game.portal.password')}</div>
          <div className="fake-button">{t('game.portal.signin')}</div>
        </div>
        <div className="fake-footer"><span>{t(kind === 'fake' ? 'game.portal.fake.footer' : 'game.portal.real.footer')}</span>{pin(3)}</div>
      </div>
    </section>
  );
}

export default function SpotTheFake({ email, division, onBack, onTakeQuiz, onScored }: SpotTheFakeProps) {
  const { t } = useI18n();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityFailed, setEligibilityFailed] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const [fakeSide] = useState<Side>(() => (Math.random() < 0.5 ? 'A' : 'B'));
  const [pin, setPin] = useState<Pin | null>(null);
  const [choice, setChoice] = useState<Side | null>(null);
  const [phase, setPhase] = useState<'playing' | 'saving' | 'result'>('playing');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/user-eligibility?email=${encodeURIComponent(email)}`)
      .then(async res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Eligibility) => { if (active) { setEligibility(data); setCooldown(data.cooldown_seconds ?? null); } })
      .catch(() => { if (active) setEligibilityFailed(true); });
    return () => { active = false; };
  }, [email]);

  useEffect(() => {
    if (cooldown === null || cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown(value => (value === null || value <= 1 ? 0 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submit() {
    if (!choice || phase === 'saving') return;
    setPhase('saving'); setFailed(false);
    try {
      const res = await fetch('/api/event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, event_type: choice === fakeSide ? 'spot_the_fake_correct' : 'spot_the_fake_incorrect', divisi: division }),
      });
      if (!res.ok) throw new Error();
      setPhase('result'); onScored();
    } catch { setPhase('playing'); setFailed(true); }
  }

  const realSide: Side = fakeSide === 'A' ? 'B' : 'A';
  const kindOf = (side: Side) => (side === fakeSide ? 'fake' : 'real') as 'fake' | 'real';
  const correct = choice === fakeSide;

  return (
    <div className="game-wrap">
      <button type="button" className="btn" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{t('game.back')}</button>
      <section className="emp-card game-card" aria-labelledby="game-title">
        <h2 id="game-title">{t('game.title')}</h2>
        {eligibilityFailed && <StateMessage variant="error" title={t('common.retry')} compact action={{ label: t('common.retry'), onClick: () => window.location.reload() }} />}
        {!eligibility && !eligibilityFailed && <StateMessage variant="loading" title={t('game.checking')} lines={3} />}

        {eligibility && !eligibility.eligible && eligibility.reason === 'safe' && (
          <div className="game-lock">
            <ShieldCheck size={32} aria-hidden="true" />
            <h3>{t('game.lock.safe.title')}</h3><p>{t('game.lock.safe.body')}</p>
            <button type="button" className="btn btn-primary" onClick={onTakeQuiz}>{t('game.lock.safe.action')}</button>
          </div>
        )}
        {eligibility && !eligibility.eligible && eligibility.reason === 'cooldown' && (
          <div className="game-lock">
            <Timer size={32} aria-hidden="true" />
            <h3>{t('game.cool.title')}</h3><p>{t('game.cool.body')}</p>
            <div className="game-timer"><span>{t('game.cool.remaining')}</span><b className="mono">{cooldown === null ? '—' : formatCooldown(cooldown)}</b></div>
          </div>
        )}

        {eligibility?.eligible && phase !== 'result' && <>
          <p className="game-intro">{t('game.intro')}</p>
          <div className="game-compare" aria-live="polite">
            {pin === null
              ? <p className="emp-muted">{t('game.compare.empty')}</p>
              : <>
                  <div className="game-compare-head"><strong>{t('game.compare.title', { detail: t(PIN_KEY[pin]) })}</strong><button type="button" className="emp-link" onClick={() => setPin(null)}>{t('game.compare.close')}</button></div>
                  <dl className="game-compare-grid">
                    {(['A', 'B'] as Side[]).map(side => {
                      const kind = kindOf(side); const data = kind === 'fake' ? FAKE : REAL;
                      return <div key={side}><dt>{t('game.page', { name: side })}</dt><dd className={pin === 1 ? 'mono' : undefined}>{pin === 1 ? data.url : pin === 2 ? t(kind === 'fake' ? 'game.portal.fake.name' : 'game.portal.real.name') : t(kind === 'fake' ? 'game.portal.fake.footer' : 'game.portal.real.footer')}</dd></div>;
                    })}
                  </dl>
                </>}
          </div>
          <div className="game-portals">
            <Portal name="A" kind={kindOf('A')} active={pin} onPin={n => setPin(pin === n ? null : n)} />
            <Portal name="B" kind={kindOf('B')} active={pin} onPin={n => setPin(pin === n ? null : n)} />
          </div>
          <div className="game-answer" role="group" aria-labelledby="game-question">
            <h3 id="game-question">{t('game.question')}</h3>
            <div className="game-choices">
              {(['A', 'B'] as Side[]).map(side => (
                <button key={side} type="button" className="btn game-choice" aria-pressed={choice === side} onClick={() => setChoice(side)}>{t('game.choose', { name: side })}</button>
              ))}
            </div>
            {choice && <p className="emp-muted">{t('game.selected', { name: choice })}</p>}
            {failed && <p className="debt-error" role="alert">{t('game.error')}</p>}
            <button type="button" className="btn btn-primary" disabled={!choice || phase === 'saving'} onClick={() => void submit()}>{phase === 'saving' ? t('game.submitting') : t('game.submit')}</button>
          </div>
        </>}

        {eligibility?.eligible && phase === 'result' && (
          <div className="game-result" role="status">
            {correct && <Confetti />}
            <div className="game-result-head" data-correct={correct}>
              {correct ? <CheckCircle2 size={28} aria-hidden="true" /> : <XCircle size={28} aria-hidden="true" />}
              <div><h3>{t(correct ? 'game.result.correct' : 'game.result.wrong')}</h3><p>{t(correct ? 'game.result.correct.body' : 'game.result.wrong.body', { name: fakeSide })}</p></div>
            </div>
            <h4>{t('game.why', { name: fakeSide })}</h4>
            <ol className="game-clues">
              <li><strong>{t('game.clue.domain.title')}</strong><span>{t('game.clue.domain.body', { fake: FAKE.address, real: REAL.address })}</span></li>
              <li><strong>{t('game.clue.footer.title')}</strong><span>{t('game.clue.footer.body')}</span></li>
              <li><strong>{t('game.clue.brand.title')}</strong><span>{t('game.clue.brand.body')}</span></li>
            </ol>
            <p className="emp-muted">{t('game.realPage', { name: realSide, address: REAL.address })}</p>
            <button type="button" className="btn btn-primary" onClick={onBack}>{t('game.done')}</button>
          </div>
        )}
      </section>
    </div>
  );
}
