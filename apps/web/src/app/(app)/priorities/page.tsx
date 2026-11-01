'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { kindLabels, kindLooks, statusLooks } from '@/components/debt/labels';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
import { StatusTag } from '@/components/ui/StatusTag';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export default function PrioritiesPage() {
  const api = useApi();
  const ready = useApiReady();
  const [productId, setProductId] = useState('');

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });
  const list = useQuery({
    queryKey: ['priorities', { productId }],
    enabled: ready,
    queryFn: async () =>
      unwrap(
        await api.GET('/priority-list', {
          params: { query: { ...(productId ? { productId } : {}) } },
        }),
      ),
  });

  return (
    <section className="stack">
      <h1 style={{ margin: 0 }}>Priorisierte Tilgungsliste</h1>
      <div className="toolbar">
        <FormField id="p-product" label="Produkt">
          {({ id }) => (
            <SelectField
              id={id}
              value={productId}
              options={[
                { value: '', label: 'alle' },
                ...(products.data ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
              placeholder="alle"
              onChange={setProductId}
            />
          )}
        </FormField>
      </div>

      {list.isLoading && <Loading />}
      {list.error && <ErrorState message={list.error.message} />}
      {list.data && (
        <>
          <h2 style={{ margin: 0 }}>Bewertet</h2>
          {list.data.ranked.length === 0 ? (
            <Empty>Noch keine bewerteten Schulden. Bewerte Schulden auf ihrer Detailseite.</Empty>
          ) : (
            <DataGrid
              caption="Bewertete Schulden"
              data={list.data.ranked}
              rowKey={(d) => d.id}
              columns={[
                { key: 'rank', header: '#', cell: (d) => d.rank },
                {
                  key: 'title',
                  header: 'Titel',
                  cell: (d) => <Link href={`/debt/${d.id}`}>{d.title}</Link>,
                },
                { key: 'kind', header: 'Art', cell: (d) => <StatusTag look={kindLooks[d.kind]} /> },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (d) => <StatusTag look={statusLooks[d.status]} />,
                },
                {
                  key: 'priority',
                  header: 'Priorität',
                  cell: (d) =>
                    `${d.priorityEffective}${d.priorityOverride !== null ? ' (überschrieben)' : ''}`,
                },
              ]}
            />
          )}

          <h2 style={{ margin: 0 }}>Nicht bewertet ({list.data.unassessedTotal})</h2>
          {list.data.unassessed.length === 0 ? (
            <Empty>Alle offenen Schulden sind bewertet.</Empty>
          ) : (
            <DataGrid
              caption="Nicht bewertete Schulden"
              data={list.data.unassessed}
              rowKey={(d) => d.id}
              columns={[
                {
                  key: 'title',
                  header: 'Titel',
                  cell: (d) => <Link href={`/debt/${d.id}`}>{d.title}</Link>,
                },
                { key: 'kind', header: 'Art', cell: (d) => kindLabels[d.kind] },
              ]}
            />
          )}
        </>
      )}
    </section>
  );
}
