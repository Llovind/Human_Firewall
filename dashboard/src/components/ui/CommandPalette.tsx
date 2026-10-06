'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import { useI18n } from '@/i18n/I18nProvider';

export interface Command {
  id: string;
  label: string;
  group: 'pages' | 'actions';
  icon?: ReactNode;
  run: () => void;
}

/** "Go to": type a few letters, pick a page or an action. Only things that exist: no invented results. */
export default function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // The dialog opens after this component's effects run and puts focus on its close button, so ask for focus one frame later.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    return commands.filter(command => !text || command.label.toLowerCase().includes(text));
  }, [commands, query]);
  const index = Math.min(active, Math.max(0, matches.length - 1));

  const close = () => { onClose(); setQuery(''); setActive(0); };
  const choose = (command: Command | undefined) => { if (!command) return; close(); command.run(); };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(matches.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, index - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(matches[index]); }
  };

  const groups = (['pages', 'actions'] as const).map(group => ({ group, items: matches.filter(command => command.group === group) })).filter(entry => entry.items.length);
  return (
    <Dialog open={open} onClose={close} size="sm" title={t('cmd.title')}>
      <div className="cmd">
        <label className="filter-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">{t('nav.search.label')}</span>
          <input ref={input} role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-activedescendant={matches[index] ? `cmd-${matches[index].id}` : undefined}
            value={query} placeholder={t('cmd.placeholder')} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKey} />
        </label>
        <div id="cmd-list" role="listbox" aria-label={t('cmd.title')} className="cmd-list">
          {matches.length === 0 && <p className="emp-muted">{t('cmd.none', { q: query })}</p>}
          {groups.map(({ group, items }) => (
            <div key={group} role="group" aria-label={t(`cmd.${group}`)}>
              <p className="cmd-group">{t(`cmd.${group}`)}</p>
              {items.map(command => (
                <div key={command.id} id={`cmd-${command.id}`} role="option" aria-selected={matches[index]?.id === command.id} className="cmd-item"
                  onMouseEnter={() => setActive(matches.indexOf(command))} onClick={() => choose(command)}>
                  {command.icon}<span>{command.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="emp-muted">{t('cmd.hint')}</p>
      </div>
    </Dialog>
  );
}
