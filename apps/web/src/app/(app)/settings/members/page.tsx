'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

type Role = 'admin' | 'editor';
const roleLabels: Record<Role, string> = { admin: 'Administrator', editor: 'Bearbeiter' };

export default function MembersPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState<Role>('editor');
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rolle konnte nicht geändert werden');
    }
  };

  const candidates = users.data?.filter((u) => !members.data?.some((m) => m.userId === u.id)) ?? [];

  return (
    <section>
      <h1>Rollen</h1>
      <p style={{ color: '#555' }}>
        Alle angemeldeten Benutzer dürfen lesen. Schreiben und Verwalten richtet sich nach der Rolle
        im Produkt. Nur Administratoren des Produkts ändern Rollen; ein Produkt behält mindestens
        einen Administrator.
      </p>
      <label>
        Produkt{' '}
        <select value={selected} onChange={(e) => setProductId(e.target.value)}>
          {products.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}

      {members.isLoading && <Loading />}
      {members.error && <ErrorState message={members.error.message} />}
      {members.data?.length === 0 && <Empty>Dieses Produkt hat noch keine Mitglieder.</Empty>}
      {members.data && members.data.length > 0 && (
        <table style={{ borderCollapse: 'collapse', margin: '12px 0' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.data.map((m) => (
              <tr key={m.userId} style={{ borderTop: '1px solid #ddd' }}>
                <td style={{ paddingRight: 16 }}>{m.name}</td>
                <td style={{ paddingRight: 16 }}>{m.email ?? '–'}</td>
                <td style={{ paddingRight: 16 }}>
                  <select
                    aria-label={`Rolle von ${m.name}`}
                    value={m.role}
                    onChange={(e) => setRole(m.userId, e.target.value as Role)}
                  >
                    {Object.entries(roleLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" onClick={() => setRole(m.userId, null)}>
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newUser) return;
          await setRole(newUser, newRole);
          setNewUser('');
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'end' }}
        aria-label="Mitglied hinzufügen"
      >
        <label>
          Benutzer
          <select value={newUser} onChange={(e) => setNewUser(e.target.value)}>
            <option value="">– wählen –</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rolle
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            {Object.entries(roleLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!newUser}>
          Hinzufügen
        </button>
      </form>
    </section>
  );
}
