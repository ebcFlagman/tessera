'use client';

import { Button } from '@primereact/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataGrid } from '@/components/ui/DataGrid';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { InlineError } from '@/components/ui/PageStates';
import { SelectField } from '@/components/ui/SelectField';
import { unwrap, useApi, useApiReady } from '@/lib/api';

type Role = 'admin' | 'editor';
const roleLabels: Record<Role, string> = { admin: 'Administrator', editor: 'Bearbeiter' };
const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }));

export default function MembersPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState<Role>('editor');
  const [error, setError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<{ userId: string; name: string } | null>(null);

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });
  const selected = productId || products.data?.[0]?.id || '';

  const members = useQuery({
    queryKey: ['members', selected],
    enabled: ready && !!selected,
    queryFn: async () =>
      unwrap(await api.GET('/products/{id}/members', { params: { path: { id: selected } } })),
  });
  const users = useQuery({
    queryKey: ['users'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/users', { params: { query: {} } })),
  });

  const setRole = async (userId: string, role: Role | null) => {
    setError(null);
    try {
      const list = unwrap(
        await api.PUT('/products/{id}/members', {
          params: { path: { id: selected } },
          body: { userId, role },
        }),
      );
      qc.setQueryData(['members', selected], list);
      notify.success(role ? 'Rolle gespeichert' : 'Mitglied entfernt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rolle konnte nicht geändert werden');
    }
  };

  const candidates = users.data?.filter((u) => !members.data?.some((m) => m.userId === u.id)) ?? [];

  return (
    <section className="stack">
      <h1 style={{ margin: 0 }}>Rollen</h1>
      <p className="page-empty" style={{ margin: 0 }}>
        Alle angemeldeten Benutzer dürfen lesen. Schreiben und Verwalten richtet sich nach der Rolle
        im Produkt. Nur Administratoren des Produkts ändern Rollen; ein Produkt behält mindestens
        einen Administrator.
      </p>
      <div className="toolbar">
        <FormField id="members-product" label="Produkt">
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

      {members.isLoading && <Loading />}
      {members.error && <ErrorState message={members.error.message} />}
      {members.data?.length === 0 && <Empty>Dieses Produkt hat noch keine Mitglieder.</Empty>}
      {members.data && members.data.length > 0 && (
        <DataGrid
          caption="Mitglieder"
          data={members.data}
          rowKey={(m) => m.userId}
          columns={[
            { key: 'name', header: 'Name', cell: (m) => m.name },
            { key: 'email', header: 'E-Mail', cell: (m) => m.email ?? '–' },
            {
              key: 'role',
              header: 'Rolle',
              cell: (m) => (
                <FormField id={`role-${m.userId}`} label={`Rolle von ${m.name}`}>
                  {({ id }) => (
                    <SelectField
                      id={id}
                      value={m.role}
                      options={roleOptions}
                      onChange={(v) => void setRole(m.userId, v as Role)}
                    />
                  )}
                </FormField>
              ),
            },
            {
              key: 'remove',
              header: 'Aktion',
              cell: (m) => (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  onClick={() => setToRemove({ userId: m.userId, name: m.name })}
                >
                  Entfernen
                </Button>
              ),
            },
          ]}
        />
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newUser) return;
          await setRole(newUser, newRole);
          setNewUser('');
        }}
        className="toolbar"
        aria-label="Mitglied hinzufügen"
      >
        <FormField id="member-user" label="Benutzer">
          {({ id }) => (
            <SelectField
              id={id}
              value={newUser}
              options={candidates.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="– wählen –"
              onChange={setNewUser}
            />
          )}
        </FormField>
        <FormField id="member-role" label="Rolle">
          {({ id }) => (
            <SelectField
              id={id}
              value={newRole}
              options={roleOptions}
              onChange={(v) => setNewRole(v as Role)}
            />
          )}
        </FormField>
        <div className="form-field">
          <Button type="submit" disabled={!newUser}>
            Hinzufügen
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={toRemove !== null}
        title={toRemove ? `${toRemove.name} entfernen?` : ''}
        confirmLabel="Entfernen"
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          const target = toRemove;
          setToRemove(null);
          if (target) void setRole(target.userId, null);
        }}
      >
        Die Person verliert ihre Schreibrechte auf dieses Produkt.
      </ConfirmDialog>
    </section>
  );
}
