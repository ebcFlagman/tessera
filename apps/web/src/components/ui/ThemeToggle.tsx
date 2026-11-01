'use client';

import { Button } from '@primereact/ui/button';
import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';
const KEY = 'tessera-theme';
const options: { mode: Mode; label: string }[] = [
  { mode: 'light', label: 'Hell' },
  { mode: 'dark', label: 'Dunkel' },
  { mode: 'system', label: 'System' },
];

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(mode: Mode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/** Light / dark / follow the system; the choice lives only in this browser (data-model.md). */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    setMode(readMode());
  }, []);

  useEffect(() => {
    if (mode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice then only lasts until reload
    }
    apply(next);
  }

  return (
    <div role="group" aria-label="Erscheinungsbild" className="row" style={{ gap: 4 }}>
      {options.map((o) => (
        <Button
          key={o.mode}
          size="small"
          variant={mode === o.mode ? undefined : 'outlined'}
          aria-pressed={mode === o.mode}
          onClick={() => choose(o.mode)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
