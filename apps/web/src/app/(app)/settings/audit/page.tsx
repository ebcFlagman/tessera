'use client';

import { InputText } from '@primereact/ui/inputtext';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
import { unwrap, useApi, useApiReady } from '@/lib/api';

const actionLabels: Record<string, string> = {
  'membership.set': 'Rolle geändert',
  'integration.created': 'Integration angelegt',
  'integration.updated': 'Integration geändert',
  'integration.deleted': 'Integration getrennt',
  'integration.sync-requested': 'Import angefordert',
  'integration.synced': 'Import abgeschlossen',
  'assessment-model.updated': 'Bewertungsmodell geändert',
  'team.created': 'Team angelegt',
  'team.members-updated': 'Teammitglieder geändert',
  'product.created': 'Produkt angelegt',
  'product.updated': 'Produkt geändert',
  'product.archived': 'Produkt archiviert',
  'debt.created': 'Schuld angelegt',
  'debt.updated': 'Schuld geändert',
  'debt.assessed': 'Schuld bewertet',
  'debt.priority-overridden': 'Priorität überschrieben',
  'debt.priority-override-removed': 'Überschreibung entfernt',
  'debt.merged': 'Duplikate zusammengeführt',
};

export default function AuditPage() {
  const api = useApi();
  const ready = useApiReady();
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = {
    ...(action ? { action } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const log = useInfiniteQuery({
    queryKey: ['audit', query],
    enabled: ready,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/audit-log', {
          params: { query: { ...query, ...(pageParam ? { cursor: pageParam } : {}) } },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // the product list only exists to resolve product ids into names
  const products = useQuery({
    queryKey: ['products', 'all'],
    enabled: ready,
    queryFn: async () =>
      unwrap(await api.GET('/products', { params: { query: { includeArchived: 'true' } } })),
  });
  const productName = (id: string) => products.data?.find((p) => p.id === id)?.name ?? id;

  const items = log.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="stack">
      <h1 style={{ margin: 0 }}>Änderungsprotokoll</h1>
      <p className="page-empty" style={{ margin: 0 }}>
        Wer hat wann was geändert? Zugangsdaten und andere Geheimnisse erscheinen hier nie. Nur
        Administratoren sehen das Protokoll.
      </p>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="toolbar">
        <FormField id="audit-action" label="Aktion">
          {({ id }) => (
            <SelectField
              id={id}
              value={action}
              options={[
                { value: '', label: 'alle' },
                ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
              ]}
              placeholder="alle"
              onChange={setAction}
            />
          )}
        </FormField>
        <FormField id="audit-from" label="Von">
          {({ id }) => (
            <InputText
              id={id}
              type="date"
              value={from}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)}
            />
          )}
        </FormField>
        <FormField id="audit-to" label="Bis">
          {({ id }) => (
            <InputText
              id={id}
              type="date"
              value={to}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
            />
          )}
        </FormField>
      </form>

      <DataGrid
        caption="Änderungsprotokoll"
        data={items}
        rowKey={(e) => e.id}
        loading={log.isLoading}
        error={log.error?.message}
        empty="Keine Einträge für diese Filter."
        hasMore={Boolean(log.hasNextPage)}
        loadingMore={log.isFetchingNextPage}
        onLoadMore={() => log.fetchNextPage()}
        columns={[
          { key: 'at', header: 'Zeitpunkt', cell: (e) => new Date(e.at).toLocaleString('de-CH') },
          { key: 'who', header: 'Wer', cell: (e) => e.actorName ?? 'System' },
          { key: 'what', header: 'Was', cell: (e) => actionLabels[e.action] ?? e.action },
          {
            key: 'target',
            header: 'Gegenstand',
            cell: (e) =>
              e.targetType === 'product'
                ? productName(e.targetId)
                : `${e.targetType} ${e.targetId.slice(0, 8)}`,
          },
          {
            key: 'details',
            header: 'Einzelheiten',
            cell: (e) => <code style={{ fontSize: 12 }}>{JSON.stringify(e.details)}</code>,
          },
        ]}
      />
    </section>
  );
}
