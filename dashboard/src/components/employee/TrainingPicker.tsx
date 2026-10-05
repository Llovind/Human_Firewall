'use client';

import { BookOpen, Fish } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import { useI18n } from '@/i18n/I18nProvider';

interface TrainingPickerProps {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: 'game' | 'quiz') => void;
}

/** Two real buttons inside the shared dialog: keyboard, screen reader and phone friendly. */
export default function TrainingPicker({ open, onClose, onChoose }: TrainingPickerProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={t('train.title')} description={t('train.desc')} size="md">
      <div className="training-options">
        <button type="button" className="training-option" onClick={() => onChoose('game')}>
          <span className="training-icon" aria-hidden="true"><Fish size={20} /></span>
          <span className="training-title">{t('train.fake.title')}</span>
          <span className="training-body">{t('train.fake.body')}</span>
          <span className="training-meta"><span>{t('train.fake.meta')}</span><strong>{t('train.start')}</strong></span>
        </button>
        <button type="button" className="training-option" onClick={() => onChoose('quiz')}>
          <span className="training-icon" aria-hidden="true"><BookOpen size={20} /></span>
          <span className="training-title">{t('train.quiz.title')}</span>
          <span className="training-body">{t('train.quiz.body')}</span>
          <span className="training-meta"><span>{t('train.quiz.meta')}</span><strong>{t('train.start')}</strong></span>
        </button>
      </div>
    </Dialog>
  );
}
