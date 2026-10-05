import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'open' | 'ok' | 'bad' | 'warn';

/** A word with a small dot. Colour is used only for success, failure or attention. */
export default function StatusChip({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className="chip" data-tone={tone}><i aria-hidden="true" />{children}</span>;
}
