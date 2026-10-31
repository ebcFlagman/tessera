'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { unwrap, useApi, useApiReady } from '@/lib/api';
import type { SourceInfo } from './SourceBadge';

const fieldLabels: Record<string, string> = {
  title: 'Titel',
  description: 'Beschreibung',
  kind: 'Art',
  effortEstimate: 'Aufwandsschätzung',
};

/** Manually maintained fields where the source says something different. */
export function ConflictNotice({ source }: { source: SourceInfo | null }) {
  if (!source || source.conflicts.length === 0) return null;
  return (
    <div role="note" style={{ border: '1px solid #b36b00', padding: 8, margin: '8px 0' }}>
      <strong>Die Quelle weicht von manuell geänderten Feldern ab.</strong> Deine Werte bleiben
      erhalten:
      <ul>
        {source.conflicts.map((c) => (
          <li key={c.field}>
            {fieldLabels[c.field] ?? c.field}: Quelle sagt „{String(c.sourceValue ?? '')}“
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Folds a duplicate of the same product into this debt; its history and source references move over. */
export function MergeDuplicates({ debtId, productId }: { debtId: string; productId: string }) {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [duplicateId, setDuplicateId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ['merge-candidates', productId],
    enabled: ready,
    queryFn: async () =>
      unwrap(
        await api.GET('/debts', { params: { query: { productId, limit: 100, sort: 'title' } } }),
      ),
  });
  const options = candidates.data?.items.filter((d) => d.id !== debtId) ?? [];

  return (
    <section aria-labelledby="merge-heading">
      <h2 id="merge-heading">Duplikat zusammenführen</h2>
      <p style={{ color: '#555' }}>
        Verlauf und Quellenverweise des Duplikats gehen auf diese Schuld über, das Duplikat wird
        archiviert.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!duplicateId) return;
          if (!window.confirm('Duplikat wirklich in diese Schuld zusammenführen?')) return;
          try {
            unwrap(
              await api.POST('/debts/{id}/merge', {
                params: { path: { id: debtId } },
                body: { duplicateId },
              }),
            );
            setDuplicateId('');
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['debt', debtId] }),
              qc.invalidateQueries({ queryKey: ['debts'] }),
              qc.invalidateQueries({ queryKey: ['merge-candidates', productId] }),
            ]);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Zusammenführen fehlgeschlagen');
          }
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'end' }}
      >
        <label>
          Duplikat
          <select value={duplicateId} onChange={(e) => setDuplicateId(e.target.value)}>
            <option value="">– wählen –</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!duplicateId}>
          Zusammenführen
        </button>
      </form>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
    </section>
  );
}
