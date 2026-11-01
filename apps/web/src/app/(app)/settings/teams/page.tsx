'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export default function TeamsPage() {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = useQuery({
    queryKey: ['teams'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/teams')),
  });
  const users = useQuery({
    queryKey: ['users'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/users', { params: { query: {} } })),
  });

  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    }
  };

  return (
    <section>
      <h1>Teams</h1>
      <p style={{ color: '#555' }}>
        Teams gruppieren Schulden für Filter und Auswertungen. Nur Administratoren legen Teams an
        und pflegen ihre Mitglieder.
      </p>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
      {teams.isLoading && <Loading />}
      {teams.error && <ErrorState message={teams.error.message} />}
      {teams.data?.length === 0 && <Empty>Noch keine Teams. Lege unten das erste an.</Empty>}

      {teams.data?.map((t) => {
        const ids = t.members.map((m) => m.id);
        const save = (userIds: string[]) =>
          guard(async () => {
            unwrap(
              await api.PUT('/teams/{id}/members', {
                params: { path: { id: t.id } },
                body: { userIds },
              }),
            );
            await qc.invalidateQueries({ queryKey: ['teams'] });
          });
        const addable = users.data?.filter((u) => !ids.includes(u.id)) ?? [];
        return (
          <div
            key={t.id}
            style={{ border: '1px solid #ccc', padding: 12, margin: '12px 0' }}
            data-testid="team"
          >
            <h2 style={{ margin: 0 }}>{t.name}</h2>
            {t.members.length === 0 ? (
              <p style={{ color: '#555' }}>Keine Mitglieder.</p>
            ) : (
              <ul>
                {t.members.map((m) => (
                  <li key={m.id}>
                    {m.name}{' '}
                    <button type="button" onClick={() => save(ids.filter((id) => id !== m.id))}>
                      Entfernen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label>
              Mitglied hinzufügen{' '}
              <select
                value=""
                aria-label={`Mitglied zu ${t.name} hinzufügen`}
                onChange={(e) => e.target.value && save([...ids, e.target.value])}
              >
                <option value="">– wählen –</option>
                {addable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      })}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void guard(async () => {
            unwrap(await api.POST('/teams', { body: { name: name.trim() } }));
            setName('');
            await qc.invalidateQueries({ queryKey: ['teams'] });
          });
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'end' }}
        aria-label="Neues Team"
      >
        <label>
          Neues Team
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={!name.trim()}>
          Anlegen
        </button>
      </form>
    </section>
  );
}
