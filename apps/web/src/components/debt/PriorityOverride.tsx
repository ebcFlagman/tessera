'use client';

import { Button } from '@primereact/ui/button';
import { InputText } from '@primereact/ui/inputtext';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
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
  const [error, setError] = useState<{ field: 'value' | 'reason' | 'form'; text: string } | null>(
    null,
  );
  const [confirmRemove, setConfirmRemove] = useState(false);

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
            setError({ field: 'value', text: 'Der Wert muss eine Zahl von 0 bis 100 sein.' });
            return;
          }
          if (!reason.trim()) {
            setError({
              field: 'reason',
              text: 'Für das Überschreiben ist eine Begründung erforderlich.',
            });
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
            notify.success('Priorität überschrieben');
          } catch (err) {
            setError({
              field: 'form',
              text: err instanceof Error ? err.message : 'Überschreiben fehlgeschlagen',
            });
          }
        }}
        style={{ maxWidth: 560 }}
        noValidate
      >
        <FormField
          id="po-value"
          label="Priorität überschreiben (0–100)"
          error={error?.field === 'value' ? error.text : null}
        >
          {({ id, invalid, describedBy }) => (
            <InputText
              id={id}
              inputMode="decimal"
              value={value}
              invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          id="po-reason"
          label="Begründung"
          error={error?.field === 'reason' || error?.field === 'form' ? error.text : null}
        >
          {({ id, invalid, describedBy }) => (
            <InputText
              id={id}
              value={reason}
              invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
            />
          )}
        </FormField>
        <div className="row">
          <Button type="submit">Überschreiben</Button>
          {priority.priorityOverride !== null && (
            <Button type="button" variant="outlined" onClick={() => setConfirmRemove(true)}>
              Überschreibung entfernen
            </Button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={confirmRemove}
        title="Überschreibung entfernen?"
        confirmLabel="Entfernen"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          setError(null);
          try {
            unwrap(
              await api.DELETE('/debts/{id}/priority-override', {
                params: { path: { id: debtId } },
              }),
            );
            await refresh();
            notify.success('Überschreibung entfernt');
          } catch (err) {
            setError({
              field: 'form',
              text: err instanceof Error ? err.message : 'Entfernen fehlgeschlagen',
            });
          }
        }}
      >
        Es gilt danach wieder die berechnete Priorität.
      </ConfirmDialog>
    </section>
  );
}
