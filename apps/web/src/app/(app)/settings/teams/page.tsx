'use client';

import { Button } from '@primereact/ui/button';
import { Card } from '@primereact/ui/card';
import { InputText } from '@primereact/ui/inputtext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty, ErrorState, Loading } from '@/components/shell/states';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { InlineError } from '@/components/ui/PageStates';
import { SelectField } from '@/components/ui/SelectField';
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
    <section className="stack">
      <h1 style={{ margin: 0 }}>Teams</h1>
      <p className="page-empty" style={{ margin: 0 }}>
        Teams gruppieren Schulden für Filter und Auswertungen. Nur Administratoren legen Teams an
        und pflegen ihre Mitglieder.
      </p>
      {error && <InlineError>{error}</InlineError>}
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
            notify.success('Teammitglieder gespeichert');
          });
        const addable = users.data?.filter((u) => !ids.includes(u.id)) ?? [];
        return (
          <div key={t.id} data-testid="team">
            <Card.Root>
              <Card.Body>
                <Card.Title>{t.name}</Card.Title>
                <Card.Content>
                  {t.members.length === 0 ? (
                    <p className="page-empty">Keine Mitglieder.</p>
                  ) : (
                    <ul style={{ paddingLeft: 20 }}>
                      {t.members.map((m) => (
                        <li key={m.id} style={{ margin: '4px 0' }}>
                          {m.name}{' '}
                          <Button
                            type="button"
                            size="small"
                            variant="text"
                            onClick={() => save(ids.filter((id) => id !== m.id))}
                          >
                            Entfernen
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <FormField id={`add-${t.id}`} label={`Mitglied zu ${t.name} hinzufügen`}>
                    {({ id }) => (
                      <SelectField
                        id={id}
                        value=""
                        options={addable.map((u) => ({ value: u.id, label: u.name }))}
                        placeholder="– wählen –"
                        onChange={(v) => v && save([...ids, v])}
                      />
                    )}
                  </FormField>
                </Card.Content>
              </Card.Body>
            </Card.Root>
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
            notify.success('Team angelegt');
          });
        }}
        className="toolbar"
        aria-label="Neues Team"
      >
        <FormField id="team-name" label="Neues Team">
          {({ id }) => (
            <InputText
              id={id}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          )}
        </FormField>
        <div className="form-field">
          <Button type="submit" disabled={!name.trim()}>
            Anlegen
          </Button>
        </div>
      </form>
    </section>
  );
}
