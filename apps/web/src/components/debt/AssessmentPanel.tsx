'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorState, Loading } from '@/components/shell/states';
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
        style={{ display: 'grid', gap: 8, maxWidth: 560 }}
      >
        <p style={{ margin: 0, color: '#555' }}>
          Modell Version {model.data.version}. Skala 1 (niedrig) bis 5 (hoch).
        </p>
        {criteria.map((c) => (
          <label key={c.key}>
            {c.name} (Gewicht {c.weight}
            {c.direction === 'down' ? ', höherer Wert senkt die Priorität' : ''})
            <select
              aria-label={c.name}
              value={scores[c.key] ?? ''}
              onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
            >
              <option value="">– wählen –</option>
              {SCORES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Kommentar
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        {error && (
          <p role="alert" style={{ color: '#b00020', margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={!complete || saving}>
          {saving ? 'Speichert …' : 'Bewertung speichern'}
        </button>
      </form>

      <h3>Bisherige Bewertungen</h3>
      {history.data.length === 0 ? (
        <p style={{ color: '#555' }}>Noch nicht bewertet.</p>
      ) : (
        <ol style={{ paddingLeft: 20 }}>
          {history.data.map((a, i) => (
            <li key={a.id} style={{ marginBottom: 12 }}>
              <strong>
                Priorität {a.priorityCalculated}
                {i === 0 ? ' (aktuell)' : ''}
              </strong>{' '}
              – {new Date(a.assessedAt).toLocaleString('de-CH')}, {a.assessedByName ?? 'unbekannt'},
              Modell v{a.modelVersion}
              {a.comment ? ` – „${a.comment}“` : ''}
              <table style={{ borderCollapse: 'collapse', marginTop: 4 }}>
                <caption style={{ textAlign: 'left', color: '#555' }}>Herleitung</caption>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th>Kriterium</th>
                    <th>Wert</th>
                    <th>Gewicht</th>
                    <th>Beitrag</th>
                  </tr>
                </thead>
                <tbody>
                  {a.breakdown.map((b) => (
                    <tr key={b.key}>
                      <td style={{ paddingRight: 12 }}>{b.name}</td>
                      <td>{b.score}</td>
                      <td>{b.weight}</td>
                      <td>{b.contribution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
