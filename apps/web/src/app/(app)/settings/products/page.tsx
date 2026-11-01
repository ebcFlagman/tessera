'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { NoProductNotice } from '@/components/shell/NoProductNotice';
import { ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export default function ProductsPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const products = useQuery({
    queryKey: ['products', { showArchived }],
    enabled: ready,
    queryFn: async () =>
      unwrap(
        await api.GET('/products', {
          params: { query: { includeArchived: showArchived ? 'true' : 'false' } },
        }),
      ),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] });
  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  };

  const none = products.isSuccess && products.data.length === 0 && !showArchived;
  return (
    <section>
      <h1>Produkte</h1>
      <p style={{ color: '#555' }}>
        Ein Produkt ist das, wofür Schulden erfasst werden (eine Anwendung, ein Service). Wer das
        erste Produkt anlegt, wird dessen Administrator; weitere Produkte legen Administratoren an.
      </p>

      {products.isLoading && <Loading />}
      {products.error && <ErrorState message={products.error.message} />}
      {none && <NoProductNotice />}

      {products.data && products.data.length > 0 && (
        <table style={{ borderCollapse: 'collapse', margin: '12px 0' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Name</th>
              <th>Beschreibung</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.data.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #ddd' }} data-testid="product-row">
                <td style={{ paddingRight: 16 }}>
                  {p.name}
                  {p.archivedAt ? ' (archiviert)' : ''}
                </td>
                <td style={{ paddingRight: 16 }}>{p.description ?? '–'}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      guard(async () => {
                        const archive = !p.archivedAt;
                        if (
                          archive &&
                          !window.confirm(
                            `„${p.name}“ archivieren? Die Schulden des Produkts werden mit archiviert, nichts wird gelöscht.`,
                          )
                        ) {
                          return;
                        }
                        unwrap(
                          await api.PATCH('/products/{id}', {
                            params: { path: { id: p.id } },
                            body: { archived: archive },
                          }),
                        );
                        await refresh();
                      })
                    }
                  >
                    {p.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
                  </button>
                  {!p.archivedAt && <Link href="/settings/members">Rollen</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <label style={{ display: 'block', margin: '8px 0' }}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />{' '}
        Archivierte anzeigen
      </label>

      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
      {created && (
        <p role="status">
          Produkt „{created}“ angelegt. Du bist dessen Administrator.{' '}
          <Link href="/settings/members">Rollen verwalten</Link> oder{' '}
          <Link href="/debt/new">die erste Schuld erfassen</Link>.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setError('Bitte gib dem Produkt einen Namen.');
            return;
          }
          void guard(async () => {
            const product = unwrap(
              await api.POST('/products', {
                body: { name: trimmed, description: description.trim() || null },
              }),
            );
            setName('');
            setDescription('');
            setCreated(product.name);
            await refresh();
          });
        }}
        style={{ display: 'grid', gap: 8, maxWidth: 480 }}
        aria-label={none ? 'Erstes Produkt anlegen' : 'Neues Produkt'}
      >
        <h2>{none ? 'Erstes Produkt anlegen' : 'Neues Produkt'}</h2>
        <label>
          Name
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Beschreibung (optional)
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button type="submit">{none ? 'Erstes Produkt anlegen' : 'Anlegen'}</button>
      </form>
    </section>
  );
}
