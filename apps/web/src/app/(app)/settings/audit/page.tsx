'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
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
    <section>
      <h1>Änderungsprotokoll</h1>
      <p style={{ color: '#555' }}>
        Wer hat wann was geändert? Zugangsdaten und andere Geheimnisse erscheinen hier nie. Nur
        Administratoren sehen das Protokoll.
      </p>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}
      >
        <label>
          Aktion{' '}
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">alle</option>
            {Object.entries(actionLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Von <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Bis <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </form>

      {log.isLoading && <Loading />}
      {log.error && <ErrorState message={log.error.message} />}
      {log.isSuccess && items.length === 0 && <Empty>Keine Einträge für diese Filter.</Empty>}
      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Zeitpunkt</th>
              <th>Wer</th>
              <th>Was</th>
              <th>Gegenstand</th>
              <th>Einzelheiten</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid #ddd', verticalAlign: 'top' }}>
                <td style={{ paddingRight: 12 }}>{new Date(e.at).toLocaleString('de-CH')}</td>
                <td style={{ paddingRight: 12 }}>{e.actorName ?? 'System'}</td>
                <td style={{ paddingRight: 12 }}>{actionLabels[e.action] ?? e.action}</td>
                <td style={{ paddingRight: 12 }}>
                  {e.targetType === 'product'
                    ? productName(e.targetId)
                    : `${e.targetType} ${e.targetId.slice(0, 8)}`}
                </td>
                <td>
                  <code style={{ fontSize: 12 }}>{JSON.stringify(e.details)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {log.hasNextPage && (
        <button onClick={() => log.fetchNextPage()} disabled={log.isFetchingNextPage}>
          Mehr laden
        </button>
      )}
    </section>
  );
}
