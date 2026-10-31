'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { kindLabels, statusLabels } from '@/components/debt/labels';
import { SourceBadge } from '@/components/debt/SourceBadge';
import { ExportButton } from '@/components/export/ExportButton';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

type Kind = keyof typeof kindLabels;
type Status = keyof typeof statusLabels;

export default function RegisterPage() {
  const api = useApi();
  const ready = useApiReady();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [status, setStatus] = useState<Status | ''>('');
  const [productId, setProductId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [source, setSource] = useState<'' | 'manual' | 'sonarcloud' | 'gitlab'>('');
  const [sort, setSort] = useState<'-createdAt' | 'createdAt' | 'title' | 'status' | '-priority'>(
    '-createdAt',
  );

  const teams = useQuery({
    queryKey: ['teams'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/teams')),
  });

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });

  const debts = useInfiniteQuery({
    queryKey: ['debts', { q, kind, status, productId, teamId, source, sort }],
    enabled: ready,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/debts', {
          params: {
            query: {
              ...(q ? { q } : {}),
              ...(kind ? { kind } : {}),
              ...(status ? { status } : {}),
              ...(productId ? { productId } : {}),
              ...(teamId ? { teamId } : {}),
              ...(source ? { source } : {}),
              sort,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = debts.data?.pages.flatMap((p) => p.items) ?? [];
  const productName = (id: string) => products.data?.find((p) => p.id === id)?.name ?? id;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Schuldenregister</h1>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <ExportButton
            kind="debts"
            query={{ q, kind, status, productId, teamId, source }}
            label="Als CSV exportieren"
          />
          <Link href="/debt/new">Neue Schuld erfassen</Link>
        </span>
      </div>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}
      >
        <label>
          Suche <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          Art{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind | '')}>
            <option value="">alle</option>
            {Object.entries(kindLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
            <option value="">alle</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Produkt{' '}
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">alle</option>
            {products.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team{' '}
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">alle</option>
            {teams.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quelle{' '}
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="">alle</option>
            <option value="manual">manuell</option>
            <option value="sonarcloud">SonarCloud</option>
            <option value="gitlab">GitLab</option>
          </select>
        </label>
        <label>
          Sortierung{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="-createdAt">Neueste zuerst</option>
            <option value="createdAt">Älteste zuerst</option>
            <option value="title">Titel</option>
            <option value="status">Status</option>
            <option value="-priority">Priorität (hoch zuerst)</option>
          </select>
        </label>
      </form>

      {debts.isLoading && <Loading />}
      {debts.error && <ErrorState message={debts.error.message} />}
      {debts.isSuccess && items.length === 0 && (
        <Empty>Keine Schulden gefunden. Erfasse die erste Schuld oder passe die Filter an.</Empty>
      )}
      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Titel</th>
              <th>Art</th>
              <th>Status</th>
              <th>Produkt</th>
              <th>Priorität</th>
              <th>Quelle</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid #ddd' }}>
                <td>
                  <Link href={`/debt/${d.id}`}>{d.title}</Link>
                </td>
                <td>{kindLabels[d.kind]}</td>
                <td>{statusLabels[d.status]}</td>
                <td>{productName(d.productId)}</td>
                <td>{d.priorityEffective ?? '–'}</td>
                <td>
                  <SourceBadge source={d.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {debts.hasNextPage && (
        <button onClick={() => debts.fetchNextPage()} disabled={debts.isFetchingNextPage}>
          Mehr laden
        </button>
      )}
    </section>
  );
}
