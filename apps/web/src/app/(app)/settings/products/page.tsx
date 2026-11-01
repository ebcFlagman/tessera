'use client';

import { Button } from '@primereact/ui/button';
import { InputText } from '@primereact/ui/inputtext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { NoProductNotice } from '@/components/shell/NoProductNotice';
import { ErrorState, Loading } from '@/components/shell/states';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { InlineError } from '@/components/ui/PageStates';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export default function ProductsPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toArchive, setToArchive] = useState<{ id: string; name: string } | null>(null);

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
  const setArchived = (id: string, archived: boolean) =>
    guard(async () => {
      unwrap(
        await api.PATCH('/products/{id}', {
          params: { path: { id } },
          body: { archived },
        }),
      );
      await refresh();
      notify.success(archived ? 'Produkt archiviert' : 'Produkt wiederhergestellt');
    });

  const none = products.isSuccess && products.data.length === 0 && !showArchived;
  return (
    <section className="stack">
      <h1 style={{ margin: 0 }}>Produkte</h1>
      <p className="page-empty" style={{ margin: 0 }}>
        Ein Produkt ist das, wofür Schulden erfasst werden (eine Anwendung, ein Service). Wer das
        erste Produkt anlegt, wird dessen Administrator; weitere Produkte legen Administratoren an.
      </p>

      {products.isLoading && <Loading />}
      {products.error && <ErrorState message={products.error.message} />}
      {none && <NoProductNotice />}

      {products.data && products.data.length > 0 && (
        <DataGrid
          caption="Produkte"
          rowTestId="product-row"
          data={products.data}
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'name',
              header: 'Name',
              cell: (p) => `${p.name}${p.archivedAt ? ' (archiviert)' : ''}`,
            },
            { key: 'description', header: 'Beschreibung', cell: (p) => p.description ?? '–' },
            {
              key: 'actions',
              header: 'Aktionen',
              cell: (p) => (
                <span className="row">
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    onClick={() => (p.archivedAt ? void setArchived(p.id, false) : setToArchive(p))}
                  >
                    {p.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
                  </Button>
                  {!p.archivedAt && <Link href="/settings/members">Rollen</Link>}
                </span>
              ),
            },
          ]}
        />
      )}
      <CheckboxField
        id="show-archived"
        label="Archivierte anzeigen"
        checked={showArchived}
        onChange={setShowArchived}
      />

      {error && <InlineError>{error}</InlineError>}
      {created && (
        <p role="status">
          Produkt „{created}“ angelegt. Du bist dessen Administrator.{' '}
          <Link href="/settings/members">Rollen verwalten</Link> oder{' '}
          <Link href="/debt/new">die erste Schuld erfassen</Link>.
        </p>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setNameError('Bitte gib dem Produkt einen Namen.');
            return;
          }
          setNameError(null);
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
        style={{ maxWidth: 480 }}
        aria-label={none ? 'Erstes Produkt anlegen' : 'Neues Produkt'}
      >
        <h2 style={{ marginTop: 0 }}>{none ? 'Erstes Produkt anlegen' : 'Neues Produkt'}</h2>
        <FormField id="product-name" label="Name" required error={nameError}>
          {({ id, invalid, describedBy }) => (
            <InputText
              id={id}
              value={name}
              maxLength={100}
              invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField id="product-description" label="Beschreibung (optional)">
          {({ id }) => (
            <InputText
              id={id}
              value={description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
            />
          )}
        </FormField>
        {/* the access token arrives with the session; until then a request would be sent unauthenticated */}
        <Button type="submit" disabled={!ready}>
          {none ? 'Erstes Produkt anlegen' : 'Anlegen'}
        </Button>
      </form>

      <ConfirmDialog
        open={toArchive !== null}
        title={toArchive ? `„${toArchive.name}“ archivieren?` : ''}
        confirmLabel="Archivieren"
        onCancel={() => setToArchive(null)}
        onConfirm={() => {
          const target = toArchive;
          setToArchive(null);
          if (target) void setArchived(target.id, true);
        }}
      >
        Die Schulden des Produkts werden mit archiviert, nichts wird gelöscht.
      </ConfirmDialog>
    </section>
  );
}
