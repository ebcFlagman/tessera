'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { unwrap, useApi } from '@/lib/api';

export interface PriorityState {
  priorityCalculated: number | null;
  priorityOverride: number | null;
  priorityOverrideReason: string | null;
  priorityEffective: number | null;
}

const show = (n: number | null) => (n === null ? '–' : String(n));

export function PriorityOverride({
  debtId,
  priority,
}: {
  debtId: string;
  priority: PriorityState;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['debt', debtId] }),
      qc.invalidateQueries({ queryKey: ['priorities'] }),
    ]);
  };

  return (
    <section aria-labelledby="priority-heading">
      <h2 id="priority-heading">Priorität</h2>
      <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px' }}>
        <dt>Berechnet</dt>
        <dd data-testid="priority-calculated">{show(priority.priorityCalculated)}</dd>
        <dt>Überschrieben</dt>
        <dd data-testid="priority-override">
          {show(priority.priorityOverride)}
          {priority.priorityOverrideReason ? ` – „${priority.priorityOverrideReason}“` : ''}
        </dd>
        <dt>Gilt</dt>
        <dd data-testid="priority-effective">
          <strong>{show(priority.priorityEffective)}</strong>
        </dd>
      </dl>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const n = Number(value);
          if (value.trim() === '' || Number.isNaN(n) || n < 0 || n > 100) {
            setError('Der Wert muss eine Zahl von 0 bis 100 sein.');
            return;
          }
          if (!reason.trim()) {
            setError('Für das Überschreiben ist eine Begründung erforderlich.');
            return;
          }
          try {
            unwrap(
              await api.PUT('/debts/{id}/priority-override', {
                params: { path: { id: debtId } },
                body: { value: n, reason: reason.trim() },
              }),
            );
            setValue('');
            setReason('');
            await refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Überschreiben fehlgeschlagen');
          }
        }}
        style={{ display: 'grid', gap: 8, maxWidth: 560 }}
      >
        <label>
          Priorität überschreiben (0–100)
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label>
          Begründung
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && (
          <p role="alert" style={{ color: '#b00020', margin: 0 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">Überschreiben</button>
          {priority.priorityOverride !== null && (
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  unwrap(
                    await api.DELETE('/debts/{id}/priority-override', {
                      params: { path: { id: debtId } },
                    }),
                  );
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen');
                }
              }}
            >
              Überschreibung entfernen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
