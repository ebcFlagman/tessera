'use client';

import { Button } from '@primereact/ui/button';
import { Card } from '@primereact/ui/card';
import { InputText } from '@primereact/ui/inputtext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { InlineError } from '@/components/ui/PageStates';
import { SelectField } from '@/components/ui/SelectField';
import { StatusTag } from '@/components/ui/StatusTag';
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
  const [toDisconnect, setToDisconnect] = useState<{ id: string; name: string } | null>(null);

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

  const statusLooks = {
    ok: { label: statusLabels.ok, severity: 'success', symbol: '✓' },
    error: { label: statusLabels.error, severity: 'danger', symbol: '✗' },
    disabled: { label: statusLabels.disabled, severity: 'secondary', symbol: '⏸' },
  } as const;

  return (
    <section className="stack">
      <h1 style={{ margin: 0 }}>Integrationen</h1>
      <div className="toolbar">
        <FormField id="int-product" label="Produkt">
          {({ id }) => (
            <SelectField
              id={id}
              value={selected}
              options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              onChange={setProductId}
            />
          )}
        </FormField>
      </div>
      {error && <InlineError>{error}</InlineError>}

      {integrations.isLoading && <Loading />}
      {integrations.error && <ErrorState message={integrations.error.message} />}
      {integrations.data?.length === 0 && (
        <Empty>Noch keine Quelle verbunden. Lege unten die erste Integration an.</Empty>
      )}
      {integrations.data?.map((i) => (
        <div key={i.id} data-testid="integration">
          <Card.Root>
            <Card.Body>
              <Card.Title>
                {i.name} <small>({typeLabels[i.type]})</small>
              </Card.Title>
              <Card.Content>
                <p style={{ margin: '4px 0' }}>
                  Status: <StatusTag look={statusLooks[i.status]} /> · Intervall {i.scheduleMinutes}{' '}
                  min · letzter Abgleich:{' '}
                  {i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString('de-CH') : 'noch nie'}
                </p>
                {i.lastError && <InlineError>Letzter Fehler: {i.lastError}</InlineError>}
                {i.latestRun && (
                  <p style={{ margin: '4px 0' }} data-testid="latest-run">
                    Letzter Import: {stateLabels[i.latestRun.state]}
                    {i.latestRun.state === 'succeeded'
                      ? ` – ${countsText(i.latestRun.counts)}`
                      : ''}
                    {i.latestRun.state === 'failed' && i.latestRun.error
                      ? ` – ${i.latestRun.error}`
                      : ''}
                  </p>
                )}
                {messages[i.id] && <p role="status">{messages[i.id]}</p>}
              </Card.Content>
              <Card.Footer>
                <div className="row">
                  <Button
                    variant="outlined"
                    onClick={() =>
                      guard(async () => {
                        const r = unwrap(
                          await api.POST('/integrations/{id}/test', {
                            params: { path: { id: i.id } },
                          }),
                        );
                        note(i.id, `${r.ok ? '✓' : '✗'} ${r.message}`);
                      })
                    }
                  >
                    Verbindung testen
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={i.status === 'disabled'}
                    onClick={() =>
                      guard(async () => {
                        unwrap(
                          await api.POST('/integrations/{id}/sync', {
                            params: { path: { id: i.id } },
                          }),
                        );
                        note(i.id, 'Import eingeplant.');
                        await refresh();
                      })
                    }
                  >
                    Import starten
                  </Button>
                  <Button
                    variant="outlined"
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
                  </Button>
                  <Button
                    variant="outlined"
                    severity="danger"
                    onClick={() => setToDisconnect({ id: i.id, name: i.name })}
                  >
                    Trennen
                  </Button>
                </div>
              </Card.Footer>
            </Card.Body>
          </Card.Root>
        </div>
      ))}

      {selected && <CreateForm productId={selected} onCreated={refresh} onError={setError} />}

      <ConfirmDialog
        open={toDisconnect !== null}
        title={toDisconnect ? `„${toDisconnect.name}“ trennen?` : ''}
        confirmLabel="Trennen"
        danger
        onCancel={() => setToDisconnect(null)}
        onConfirm={() => {
          const target = toDisconnect;
          setToDisconnect(null);
          if (!target) return;
          void guard(async () => {
            const res = await api.DELETE('/integrations/{id}', {
              params: { path: { id: target.id } },
            });
            if (res.error)
              throw new Error(
                (res.error as { message?: string }).message ?? 'Trennen fehlgeschlagen',
              );
            await refresh();
            notify.success('Integration getrennt');
          });
        }}
      >
        Importierte Schulden bleiben erhalten.
      </ConfirmDialog>
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
          notify.success('Integration verbunden');
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
        }
      }}
      style={{ maxWidth: 480 }}
      aria-label="Neue Integration"
      noValidate
    >
      <h2 style={{ marginTop: 0 }}>Neue Integration</h2>
      <FormField id="new-type" label="Quelle">
        {({ id }) => (
          <SelectField
            id={id}
            value={type}
            options={[
              { value: 'sonarcloud', label: 'SonarCloud' },
              { value: 'gitlab', label: 'GitLab Cloud' },
            ]}
            onChange={(v) => setType(v as SourceType)}
          />
        )}
      </FormField>
      <FormField id="new-name" label="Name">
        {({ id }) => (
          <InputText
            id={id}
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        )}
      </FormField>
      {type === 'sonarcloud' ? (
        <FormField id="new-project-key" label="Projektschlüssel">
          {({ id }) => (
            <InputText
              id={id}
              value={projectKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectKey(e.target.value)}
            />
          )}
        </FormField>
      ) : (
        <>
          <FormField id="new-gitlab-project" label="Projekt-ID">
            {({ id }) => (
              <InputText
                id={id}
                value={gitlabProject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setGitlabProject(e.target.value)
                }
              />
            )}
          </FormField>
          <FormField id="new-label" label="Label für Schulden">
            {({ id }) => (
              <InputText
                id={id}
                value={label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
              />
            )}
          </FormField>
        </>
      )}
      <FormField
        id="new-base-url"
        label="Basis-URL (optional, nur für selbst gehostete Installationen)"
      >
        {({ id }) => (
          <InputText
            id={id}
            value={baseUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseUrl(e.target.value)}
          />
        )}
      </FormField>
      <FormField id="new-token" label="Zugriffstoken">
        {({ id }) => (
          <InputText
            id={id}
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
          />
        )}
      </FormField>
      <FormField id="new-schedule" label="Intervall (Minuten)">
        {({ id }) => (
          <InputText
            id={id}
            inputMode="numeric"
            value={schedule}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSchedule(e.target.value)}
          />
        )}
      </FormField>
      <Button type="submit">Verbinden</Button>
    </form>
  );
}
