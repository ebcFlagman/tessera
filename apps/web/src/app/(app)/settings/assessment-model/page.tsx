'use client';

import { Button } from '@primereact/ui/button';
import { InputText } from '@primereact/ui/inputtext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErrorState, Loading } from '@/components/shell/states';
import { DataGrid } from '@/components/ui/DataGrid';
import { notify } from '@/components/ui/Notifier';
import { InlineError } from '@/components/ui/PageStates';
import { SelectField } from '@/components/ui/SelectField';
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
    <section className="stack">
      <h1 style={{ margin: 0 }}>Bewertungsmodell</h1>
      <p style={{ margin: 0 }}>
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
            notify.success('Neue Version gespeichert');
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
        <DataGrid
          caption="Bewertungskriterien"
          data={rows}
          rowKey={(r) => String(rows.indexOf(r))}
          empty="Keine Kriterien."
          columns={[
            {
              key: 'key',
              header: 'Schlüssel',
              cell: (r) => (
                <InputText
                  aria-label={`Schlüssel ${rows.indexOf(r) + 1}`}
                  value={r.key}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update(rows.indexOf(r), { key: e.target.value })
                  }
                />
              ),
            },
            {
              key: 'name',
              header: 'Name',
              cell: (r) => (
                <InputText
                  aria-label={`Name ${rows.indexOf(r) + 1}`}
                  value={r.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update(rows.indexOf(r), { name: e.target.value })
                  }
                />
              ),
            },
            {
              key: 'weight',
              header: 'Gewicht',
              cell: (r) => (
                <InputText
                  aria-label={`Gewicht ${rows.indexOf(r) + 1}`}
                  inputMode="decimal"
                  style={{ width: '5rem' }}
                  value={r.weight}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update(rows.indexOf(r), { weight: e.target.value })
                  }
                />
              ),
            },
            {
              key: 'direction',
              header: 'Wirkung',
              cell: (r) => (
                <SelectField
                  id={`direction-${rows.indexOf(r)}`}
                  ariaLabel={`Wirkung ${rows.indexOf(r) + 1}`}
                  value={r.direction}
                  options={[
                    { value: 'up', label: 'höher = dringender' },
                    { value: 'down', label: 'höher = weniger dringend' },
                  ]}
                  onChange={(v) => update(rows.indexOf(r), { direction: v as 'up' | 'down' })}
                />
              ),
            },
            {
              key: 'remove',
              header: 'Aktion',
              cell: (r) => (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  onClick={() => setRows((all) => all.filter((x) => x !== r))}
                >
                  Entfernen
                </Button>
              ),
            },
          ]}
        />
        <div className="row" style={{ margin: '12px 0' }}>
          <Button
            type="button"
            variant="outlined"
            onClick={() =>
              setRows((all) => [...all, { key: '', name: '', weight: '1', direction: 'up' }])
            }
          >
            Kriterium hinzufügen
          </Button>
          <Button type="submit">Neue Version speichern</Button>
        </div>
        {error && <InlineError>{error}</InlineError>}
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
