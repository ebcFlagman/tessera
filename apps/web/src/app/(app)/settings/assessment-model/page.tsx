'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

interface Row {
  key: string;
  name: string;
  weight: string;
  direction: 'up' | 'down';
}

export default function AssessmentModelPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const model = useQuery({
    queryKey: ['assessment-model'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/assessment-model')),
  });

  useEffect(() => {
    if (model.data) {
      setRows(
        model.data.criteria.map((c) => ({
          key: c.key,
          name: c.name,
          weight: String(c.weight),
          direction: c.direction,
        })),
      );
    }
  }, [model.data]);

  if (model.isLoading) return <Loading />;
  if (model.error || !model.data) return <ErrorState message={model.error?.message ?? 'Fehler'} />;

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <section>
      <h1>Bewertungsmodell</h1>
      <p>
        Aktuelle Version {model.data.version}. Änderungen erzeugen eine neue Version und berechnen
        alle Prioritäten neu. Nur Administratoren dürfen speichern.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          const criteria = rows.map((r) => ({
            key: r.key.trim(),
            name: r.name.trim(),
            weight: Number(r.weight),
            direction: r.direction,
          }));
          if (criteria.some((c) => !c.key || !c.name || Number.isNaN(c.weight) || c.weight < 0)) {
            setError('Jedes Kriterium braucht Schlüssel, Namen und ein Gewicht ≥ 0.');
            return;
          }
          try {
            const r = unwrap(await api.PUT('/assessment-model', { body: { criteria } }));
            setMessage(
              `Version ${r.model.version} gespeichert: ${r.updated} Prioritäten neu berechnet, ${r.needReassessment} Schulden müssen neu bewertet werden.`,
            );
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['assessment-model'] }),
              qc.invalidateQueries({ queryKey: ['priorities'] }),
            ]);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
          }
        }}
      >
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Schlüssel</th>
              <th>Name</th>
              <th>Gewicht</th>
              <th>Wirkung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Schlüssel ${i + 1}`}
                    value={r.key}
                    onChange={(e) => update(i, { key: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Name ${i + 1}`}
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Gewicht ${i + 1}`}
                    inputMode="decimal"
                    size={4}
                    value={r.weight}
                    onChange={(e) => update(i, { weight: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Wirkung ${i + 1}`}
                    value={r.direction}
                    onChange={(e) => update(i, { direction: e.target.value as 'up' | 'down' })}
                  >
                    <option value="up">höher = dringender</option>
                    <option value="down">höher = weniger dringend</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => setRows((all) => all.filter((_, idx) => idx !== i))}
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <button
            type="button"
            onClick={() =>
              setRows((all) => [...all, { key: '', name: '', weight: '1', direction: 'up' }])
            }
          >
            Kriterium hinzufügen
          </button>
          <button type="submit">Neue Version speichern</button>
        </div>
        {error && (
          <p role="alert" style={{ color: '#b00020' }}>
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
