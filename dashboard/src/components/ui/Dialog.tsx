'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'danger';
  /** While busy (saving), Esc, the backdrop and the close button are disabled. */
  busy?: boolean;
}

/**
 * The one dialog for the product. Built on the native <dialog> element, so focus is trapped,
 * Esc closes it, and the page behind is inert. Replaces hand-built overlays and window.confirm().
 */
export default function Dialog({ open, onClose, title, description, children, footer, size = 'md', tone = 'default', busy = false }: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      data-size={size}
      data-tone={tone}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClose={() => { if (open) onClose(); }}
      onClick={event => { if (event.target === ref.current && !busy) onClose(); }}
    >
      {open && (
        <div className="ui-dialog-body">
          <button type="button" className="ui-dialog-close" aria-label={t('common.close')} disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descId} className="ui-dialog-desc">{description}</p>}
          {children}
          {footer && <div className="ui-dialog-footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
