'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { kindLabels, statusLabels } from '@/components/debt/labels';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
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
    <section>
      <h1>Priorisierte Tilgungsliste</h1>
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

      {list.isLoading && <Loading />}
      {list.error && <ErrorState message={list.error.message} />}
      {list.data && (
        <>
          <h2>Bewertet</h2>
          {list.data.ranked.length === 0 ? (
            <Empty>Noch keine bewerteten Schulden. Bewerte Schulden auf ihrer Detailseite.</Empty>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>#</th>
                  <th>Titel</th>
                  <th>Art</th>
                  <th>Status</th>
                  <th>Priorität</th>
                </tr>
              </thead>
              <tbody>
                {list.data.ranked.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #ddd' }}>
                    <td>{d.rank}</td>
                    <td>
                      <Link href={`/debt/${d.id}`}>{d.title}</Link>
                    </td>
                    <td>{kindLabels[d.kind]}</td>
                    <td>{statusLabels[d.status]}</td>
                    <td>
                      {d.priorityEffective}
                      {d.priorityOverride !== null ? ' (überschrieben)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Nicht bewertet ({list.data.unassessedTotal})</h2>
          {list.data.unassessed.length === 0 ? (
            <Empty>Alle offenen Schulden sind bewertet.</Empty>
          ) : (
            <ul>
              {list.data.unassessed.map((d) => (
                <li key={d.id}>
                  <Link href={`/debt/${d.id}`}>{d.title}</Link> – {kindLabels[d.kind]}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
