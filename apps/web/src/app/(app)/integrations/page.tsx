'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

type SourceType = 'sonarcloud' | 'gitlab';
const typeLabels: Record<SourceType, string> = { sonarcloud: 'SonarCloud', gitlab: 'GitLab Cloud' };
const stateLabels = {
  queued: 'wartet',
  running: 'läuft',
  succeeded: 'abgeschlossen',
  failed: 'fehlgeschlagen',
} as const;
const statusLabels = { ok: 'in Ordnung', error: 'Fehler', disabled: 'deaktiviert' } as const;

const countsText = (c: Record<string, number>) =>
  `${c.created ?? 0} neu, ${c.updated ?? 0} aktualisiert, ${c.repaid ?? 0} behoben, ${c.reopened ?? 0} wieder geöffnet, ${c.unchanged ?? 0} unverändert`;

export default function IntegrationsPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });
  const selected = productId || products.data?.[0]?.id || '';

  const integrations = useQuery({
    queryKey: ['integrations', selected],
    enabled: ready && !!selected,
    // keep polling while an import is queued or running
    refetchInterval: (q) =>
      q.state.data?.some((i) => i.latestRun && ['queued', 'running'].includes(i.latestRun.state))
        ? 2000
        : false,
    queryFn: async () =>
      unwrap(await api.GET('/products/{id}/integrations', { params: { path: { id: selected } } })),
  });

  // the administrator notice must follow the import results without waiting for its own timer
  const runStates = integrations.data
    ?.map((i) => `${i.id}:${i.latestRun?.state}:${i.status}`)
    .join(',');
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ['integrations', 'attention'] });
  }, [runStates, qc]);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['integrations'] }),
      qc.invalidateQueries({ queryKey: ['debts'] }),
    ]);
  const note = (id: string, text: string) => setMessages((m) => ({ ...m, [id]: text }));
  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  };

  return (
    <section>
      <h1>Integrationen</h1>
      <label>
        Produkt{' '}
        <select value={selected} onChange={(e) => setProductId(e.target.value)}>
          {products.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}

      {integrations.isLoading && <Loading />}
      {integrations.error && <ErrorState message={integrations.error.message} />}
      {integrations.data?.length === 0 && (
        <Empty>Noch keine Quelle verbunden. Lege unten die erste Integration an.</Empty>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {integrations.data?.map((i) => (
          <li
            key={i.id}
            style={{ border: '1px solid #ccc', padding: 12, margin: '12px 0' }}
            data-testid="integration"
          >
            <h2 style={{ margin: 0 }}>
              {i.name} <small>({typeLabels[i.type]})</small>
            </h2>
            <p style={{ margin: '4px 0' }}>
              Status: <strong>{statusLabels[i.status]}</strong> · Intervall {i.scheduleMinutes} min
              · letzter Abgleich:{' '}
              {i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString('de-CH') : 'noch nie'}
            </p>
            {i.lastError && (
              <p role="alert" style={{ color: '#b00020', margin: '4px 0' }}>
                Letzter Fehler: {i.lastError}
              </p>
            )}
            {i.latestRun && (
              <p style={{ margin: '4px 0' }} data-testid="latest-run">
                Letzter Import: {stateLabels[i.latestRun.state]}
                {i.latestRun.state === 'succeeded' ? ` – ${countsText(i.latestRun.counts)}` : ''}
                {i.latestRun.state === 'failed' && i.latestRun.error
                  ? ` – ${i.latestRun.error}`
                  : ''}
              </p>
            )}
            {messages[i.id] && <p role="status">{messages[i.id]}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() =>
                  guard(async () => {
                    const r = unwrap(
                      await api.POST('/integrations/{id}/test', { params: { path: { id: i.id } } }),
                    );
                    note(i.id, `${r.ok ? '✓' : '✗'} ${r.message}`);
                  })
                }
              >
                Verbindung testen
              </button>
              <button
                disabled={i.status === 'disabled'}
                onClick={() =>
                  guard(async () => {
                    unwrap(
                      await api.POST('/integrations/{id}/sync', { params: { path: { id: i.id } } }),
                    );
                    note(i.id, 'Import eingeplant.');
                    await refresh();
                  })
                }
              >
                Import starten
              </button>
              <button
                onClick={() =>
                  guard(async () => {
                    unwrap(
                      await api.PATCH('/integrations/{id}', {
                        params: { path: { id: i.id } },
                        body: { disabled: i.status !== 'disabled' },
                      }),
                    );
                    await refresh();
                  })
                }
              >
                {i.status === 'disabled' ? 'Aktivieren' : 'Deaktivieren'}
              </button>
              <button
                onClick={() =>
                  guard(async () => {
                    if (
                      !window.confirm(`„${i.name}“ trennen? Importierte Schulden bleiben erhalten.`)
                    )
                      return;
                    const res = await api.DELETE('/integrations/{id}', {
                      params: { path: { id: i.id } },
                    });
                    if (res.error)
                      throw new Error(
                        (res.error as { message?: string }).message ?? 'Trennen fehlgeschlagen',
                      );
                    await refresh();
                  })
                }
              >
                Trennen
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selected && <CreateForm productId={selected} onCreated={refresh} onError={setError} />}
    </section>
  );
}

function CreateForm({
  productId,
  onCreated,
  onError,
}: {
  productId: string;
  onCreated: () => Promise<unknown>;
  onError: (message: string | null) => void;
}) {
  const api = useApi();
  const [type, setType] = useState<SourceType>('sonarcloud');
  const [name, setName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [gitlabProject, setGitlabProject] = useState('');
  const [label, setLabel] = useState('tech-debt');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [schedule, setSchedule] = useState('60');

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        onError(null);
        const minutes = Number(schedule);
        if (!name.trim() || !token) return onError('Name und Zugriffstoken sind erforderlich.');
        if (!Number.isInteger(minutes) || minutes < 5)
          return onError('Das Intervall muss mindestens 5 Minuten betragen.');
        const config = {
          ...(type === 'sonarcloud'
            ? { projectKey: projectKey.trim() }
            : { projectId: gitlabProject.trim(), label: label.trim() }),
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        };
        try {
          unwrap(
            await api.POST('/products/{id}/integrations', {
              params: { path: { id: productId } },
              body: {
                type,
                name: name.trim(),
                config,
                credentials: token,
                scheduleMinutes: minutes,
              },
            }),
          );
          setName('');
          setToken('');
          await onCreated();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
        }
      }}
      style={{ display: 'grid', gap: 8, maxWidth: 480 }}
      aria-label="Neue Integration"
    >
      <h2>Neue Integration</h2>
      <label>
        Quelle
        <select value={type} onChange={(e) => setType(e.target.value as SourceType)}>
          <option value="sonarcloud">SonarCloud</option>
          <option value="gitlab">GitLab Cloud</option>
        </select>
      </label>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {type === 'sonarcloud' ? (
        <label>
          Projektschlüssel
          <input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
        </label>
      ) : (
        <>
          <label>
            Projekt-ID
            <input value={gitlabProject} onChange={(e) => setGitlabProject(e.target.value)} />
          </label>
          <label>
            Label für Schulden
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
        </>
      )}
      <label>
        Basis-URL (optional, nur für selbst gehostete Installationen)
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      </label>
      <label>
        Zugriffstoken
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <label>
        Intervall (Minuten)
        <input inputMode="numeric" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
      </label>
      <button type="submit">Verbinden</button>
    </form>
  );
}
