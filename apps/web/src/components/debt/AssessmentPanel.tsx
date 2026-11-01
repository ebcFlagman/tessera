'use client';

import { Button } from '@primereact/ui/button';
import { Message } from '@primereact/ui/message';
import { Textarea } from '@primereact/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorState, Loading } from '@/components/shell/states';
import { DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { SelectField } from '@/components/ui/SelectField';
import { unwrap, useApi, useApiReady } from '@/lib/api';

const SCORES = [1, 2, 3, 4, 5] as const;

export function AssessmentPanel({ debtId }: { debtId: string }) {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const model = useQuery({
    queryKey: ['assessment-model'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/assessment-model')),
  });
  const history = useQuery({
    queryKey: ['assessments', debtId],
    enabled: ready,
    queryFn: async () =>
      unwrap(await api.GET('/debts/{id}/assessments', { params: { path: { id: debtId } } })),
  });

  if (model.isLoading || history.isLoading) return <Loading />;
  if (model.error || history.error || !model.data || !history.data) {
    return <ErrorState message={(model.error ?? history.error)?.message ?? 'Unbekannter Fehler'} />;
  }
  const criteria = model.data.criteria;
  const complete = criteria.every((c) => scores[c.key] !== undefined);

  return (
    <section aria-labelledby="assessment-heading">
      <h2 id="assessment-heading">Bewertung</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaving(true);
          try {
            unwrap(
              await api.POST('/debts/{id}/assessments', {
                params: { path: { id: debtId } },
                body: { scores, comment: comment.trim() || null },
              }),
            );
            setScores({});
            setComment('');
            notify.success('Bewertung gespeichert');
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['assessments', debtId] }),
              qc.invalidateQueries({ queryKey: ['debt', debtId] }),
              qc.invalidateQueries({ queryKey: ['priorities'] }),
            ]);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Bewertung fehlgeschlagen');
          } finally {
            setSaving(false);
          }
        }}
        style={{ maxWidth: 560 }}
      >
        <p className="page-empty" style={{ marginTop: 0 }}>
          Modell Version {model.data.version}. Skala 1 (niedrig) bis 5 (hoch).
        </p>
        {criteria.map((c) => (
          <FormField
            key={c.key}
            id={`score-${c.key}`}
            label={`${c.name} (Gewicht ${c.weight}${c.direction === 'down' ? ', höherer Wert senkt die Priorität' : ''})`}
          >
            {({ id }) => (
              <SelectField
                id={id}
                value={scores[c.key] === undefined ? '' : String(scores[c.key])}
                options={SCORES.map((n) => ({ value: String(n), label: String(n) }))}
                placeholder="– wählen –"
                onChange={(v) => setScores((s) => ({ ...s, [c.key]: Number(v) }))}
              />
            )}
          </FormField>
        ))}
        <FormField id="assessment-comment" label="Kommentar">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={comment}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            />
          )}
        </FormField>
        {error && (
          <Message.Root severity="error" role="alert">
            <Message.Content>
              <Message.Text>{error}</Message.Text>
            </Message.Content>
          </Message.Root>
        )}
        <Button type="submit" disabled={!complete || saving}>
          {saving ? 'Speichert …' : 'Bewertung speichern'}
        </Button>
      </form>

      <h3>Bisherige Bewertungen</h3>
      {history.data.length === 0 ? (
        <p className="page-empty">Noch nicht bewertet.</p>
      ) : (
        <div className="stack">
          {history.data.map((a, i) => (
            <div key={a.id}>
              <p style={{ margin: '0 0 4px' }}>
                <strong>
                  Priorität {a.priorityCalculated}
                  {i === 0 ? ' (aktuell)' : ''}
                </strong>{' '}
                – {new Date(a.assessedAt).toLocaleString('de-CH')},{' '}
                {a.assessedByName ?? 'unbekannt'}, Modell v{a.modelVersion}
                {a.comment ? ` – „${a.comment}“` : ''}
              </p>
              <small className="page-empty">Herleitung</small>
              <DataGrid
                caption="Herleitung"
                data={a.breakdown}
                rowKey={(b) => b.key}
                columns={[
                  { key: 'name', header: 'Kriterium', cell: (b) => b.name },
                  { key: 'score', header: 'Wert', cell: (b) => b.score },
                  { key: 'weight', header: 'Gewicht', cell: (b) => b.weight },
                  { key: 'contribution', header: 'Beitrag', cell: (b) => b.contribution },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
