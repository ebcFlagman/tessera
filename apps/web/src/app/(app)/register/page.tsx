'use client';

import { InputText } from '@primereact/ui/inputtext';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { kindLabels, kindLooks, statusLabels, statusLooks } from '@/components/debt/labels';
import { SourceBadge } from '@/components/debt/SourceBadge';
import { ExportButton } from '@/components/export/ExportButton';
import { NoProductNotice } from '@/components/shell/NoProductNotice';
import { type Column, DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
import { StatusTag } from '@/components/ui/StatusTag';
import { unwrap, useApi, useApiReady } from '@/lib/api';

type Kind = keyof typeof kindLabels;
type Status = keyof typeof statusLabels;
type Sort = '-createdAt' | 'createdAt' | 'title' | 'status' | '-priority';

const ALL = { label: 'alle', value: '' };
const kindOptions = [
  ALL,
  ...Object.entries(kindLabels).map(([value, label]) => ({ value, label })),
];
const statusOptions = [
  ALL,
  ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
];
const sourceOptions = [
  ALL,
  { label: 'manuell', value: 'manual' },
  { label: 'SonarCloud', value: 'sonarcloud' },
  { label: 'GitLab', value: 'gitlab' },
];
const sortOptions = [
  { label: 'Neueste zuerst', value: '-createdAt' },
  { label: 'Älteste zuerst', value: 'createdAt' },
  { label: 'Titel', value: 'title' },
  { label: 'Status', value: 'status' },
  { label: 'Priorität (hoch zuerst)', value: '-priority' },
];

export default function RegisterPage() {
  const api = useApi();
  const ready = useApiReady();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [status, setStatus] = useState<Status | ''>('');
  const [productId, setProductId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [source, setSource] = useState<'' | 'manual' | 'sonarcloud' | 'gitlab'>('');
  const [sort, setSort] = useState<Sort>('-createdAt');

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

  type Item = (typeof items)[number];
  const columns: Column<Item>[] = [
    { key: 'title', header: 'Titel', cell: (d) => <Link href={`/debt/${d.id}`}>{d.title}</Link> },
    { key: 'kind', header: 'Art', cell: (d) => <StatusTag look={kindLooks[d.kind]} /> },
    { key: 'status', header: 'Status', cell: (d) => <StatusTag look={statusLooks[d.status]} /> },
    { key: 'product', header: 'Produkt', cell: (d) => productName(d.productId) },
    {
      key: 'priority',
      header: 'Priorität',
      cell: (d) => d.priorityEffective ?? '–',
    },
    { key: 'source', header: 'Quelle', cell: (d) => <SourceBadge source={d.source} /> },
  ];

  return (
    <section className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Schuldenregister</h1>
        <span className="spacer row" style={{ marginLeft: 'auto' }}>
          <ExportButton
            kind="debts"
            query={{ q, kind, status, productId, teamId, source }}
            label="Als CSV exportieren"
          />
          <Link href="/debt/new">Neue Schuld erfassen</Link>
        </span>
      </div>

      {products.isSuccess && products.data.length === 0 && <NoProductNotice />}

      <form role="search" onSubmit={(e) => e.preventDefault()} className="toolbar">
        <FormField id="f-q" label="Suche">
          {({ id }) => (
            <InputText
              id={id}
              value={q}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            />
          )}
        </FormField>
        <FormField id="f-kind" label="Art">
          {({ id }) => (
            <SelectField
              id={id}
              value={kind}
              options={kindOptions}
              placeholder="alle"
              onChange={(v) => setKind(v as Kind | '')}
            />
          )}
        </FormField>
        <FormField id="f-status" label="Status">
          {({ id }) => (
            <SelectField
              id={id}
              value={status}
              options={statusOptions}
              placeholder="alle"
              onChange={(v) => setStatus(v as Status | '')}
            />
          )}
        </FormField>
        <FormField id="f-product" label="Produkt">
          {({ id }) => (
            <SelectField
              id={id}
              value={productId}
              options={[ALL, ...(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
              placeholder="alle"
              onChange={setProductId}
            />
          )}
        </FormField>
        <FormField id="f-team" label="Team">
          {({ id }) => (
            <SelectField
              id={id}
              value={teamId}
              options={[ALL, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
              placeholder="alle"
              onChange={setTeamId}
            />
          )}
        </FormField>
        <FormField id="f-source" label="Quelle">
          {({ id }) => (
            <SelectField
              id={id}
              value={source}
              options={sourceOptions}
              placeholder="alle"
              onChange={(v) => setSource(v as typeof source)}
            />
          )}
        </FormField>
        <FormField id="f-sort" label="Sortierung">
          {({ id }) => (
            <SelectField
              id={id}
              value={sort}
              options={sortOptions}
              onChange={(v) => setSort(v as Sort)}
            />
          )}
        </FormField>
      </form>

      <DataGrid
        caption="Schulden"
        data={items}
        columns={columns}
        rowKey={(d) => d.id}
        loading={debts.isLoading}
        error={debts.error?.message}
        empty="Keine Schulden gefunden. Erfasse die erste Schuld oder passe die Filter an."
        hasMore={Boolean(debts.hasNextPage)}
        loadingMore={debts.isFetchingNextPage}
        onLoadMore={() => debts.fetchNextPage()}
      />
    </section>
  );
}
