'use client';

import { useState, useSyncExternalStore } from 'react';
import Dialog from '@/components/ui/Dialog';
import { usePreference } from '@/hooks/usePreference';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

export type TourRole = 'employee' | 'soc' | 'grc' | 'ciso' | 'phishing_admin';
const STEPS: Record<TourRole, number> = { employee: 4, soc: 4, grc: 4, ciso: 3, phishing_admin: 3 };
export const tourKey = (role: TourRole) => `afferent_tour_${role}`;

/** Shown once per person on this browser, never again unless they ask from Settings. */
export default function FirstRunTour({ role }: { role: TourRole }) {
  const { t } = useI18n();
  const [seen, setSeen] = usePreference(tourKey(role), '');
  const [step, setStep] = useState(1);
  const total = STEPS[role];
  // Wait for the browser, so people who already saw the tour never see it flash.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const finish = () => { setSeen('1'); setStep(1); };
  return (
    <Dialog open={mounted && seen !== '1'} onClose={finish} size="sm" title={t(`tour.${role}.${step}.title` as MessageKey)} description={t('tour.step', { n: step, total })}
      footer={<>
        <button type="button" className="btn" onClick={finish}>{t('tour.skip')}</button>
        {step > 1 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>{t('tour.back')}</button>}
        {step < total
          ? <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>{t('tour.next')}</button>
          : <button type="button" className="btn btn-primary" onClick={finish}>{t('tour.done')}</button>}
      </>}>
      <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6 }}>{t(`tour.${role}.${step}.text` as MessageKey)}</p>
    </Dialog>
  );
}
