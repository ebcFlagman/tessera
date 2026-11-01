'use client';

import { Button } from '@primereact/ui/button';
import { InputText } from '@primereact/ui/inputtext';
import { Message } from '@primereact/ui/message';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/components/ui/Notifier';
import { SelectField } from '@/components/ui/SelectField';
import { unwrap, useApi, useApiReady } from '@/lib/api';
import type { SourceInfo } from './SourceBadge';

const fieldLabels: Record<string, string> = {
  title: 'Titel',
  description: 'Beschreibung',
  kind: 'Art',
  effortEstimate: 'Aufwandsschätzung',
};

/** Manually maintained fields where the source says something different. */
export function ConflictNotice({ source }: { source: SourceInfo | null }) {
  if (!source || source.conflicts.length === 0) return null;
  return (
    <Message.Root severity="warn" role="note">
      <Message.Content>
        <Message.Icon />
        <Message.Text>
          <strong>Die Quelle weicht von manuell geänderten Feldern ab.</strong> Deine Werte bleiben
          erhalten:
          <span style={{ display: 'block' }}>
            {source.conflicts.map((c) => (
              <span key={c.field} style={{ display: 'block' }}>
                {fieldLabels[c.field] ?? c.field}: Quelle sagt „{String(c.sourceValue ?? '')}“
              </span>
            ))}
          </span>
        </Message.Text>
      </Message.Content>
    </Message.Root>
  );
}

/** Folds a duplicate of the same product into this debt; its history and source references move over. */
export function MergeDuplicates({ debtId, productId }: { debtId: string; productId: string }) {
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();
  const [duplicateId, setDuplicateId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);

  // searched on the server: a register can hold far more debts than a list could show
  const term = search.trim();
  const candidates = useQuery({
    queryKey: ['merge-candidates', productId, term],
    enabled: ready,
    queryFn: async () =>
      unwrap(
        await api.GET('/debts', {
          params: {
            query: { productId, limit: 20, sort: '-createdAt', ...(term ? { q: term } : {}) },
          },
        }),
      ),
  });
  const options = candidates.data?.items.filter((d) => d.id !== debtId) ?? [];

  return (
    <section aria-labelledby="merge-heading">
      <h2 id="merge-heading">Duplikat zusammenführen</h2>
      <p className="page-empty">
        Verlauf und Quellenverweise des Duplikats gehen auf diese Schuld über, das Duplikat wird
        archiviert.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (duplicateId) setConfirming(true);
        }}
        className="toolbar"
      >
        <FormField id="merge-search" label="Duplikat suchen">
          {({ id }) => (
            <InputText
              id={id}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          )}
        </FormField>
        <FormField id="merge-duplicate" label="Duplikat">
          {({ id }) => (
            <SelectField
              id={id}
              value={duplicateId}
              options={options.map((d) => ({ value: d.id, label: d.title }))}
              placeholder="– wählen –"
              onChange={setDuplicateId}
            />
          )}
        </FormField>
        <div className="form-field">
          <Button type="submit" disabled={!duplicateId}>
            Zusammenführen
          </Button>
        </div>
      </form>
      {error && (
        <Message.Root severity="error" role="alert">
          <Message.Content>
            <Message.Text>{error}</Message.Text>
          </Message.Content>
        </Message.Root>
      )}
      <ConfirmDialog
        open={confirming}
        busy={merging}
        title="Duplikat zusammenführen?"
        confirmLabel="Zusammenführen"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setMerging(true);
          try {
            unwrap(
              await api.POST('/debts/{id}/merge', {
                params: { path: { id: debtId } },
                body: { duplicateId },
              }),
            );
            setDuplicateId('');
            setConfirming(false);
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['debt', debtId] }),
              qc.invalidateQueries({ queryKey: ['debts'] }),
              qc.invalidateQueries({ queryKey: ['merge-candidates', productId] }),
            ]);
            notify.success('Duplikat zusammengeführt');
          } catch (err) {
            setConfirming(false);
            setError(err instanceof Error ? err.message : 'Zusammenführen fehlgeschlagen');
          } finally {
            setMerging(false);
          }
        }}
      >
        Das Duplikat wird archiviert; diese Aktion lässt sich nicht von hier aus rückgängig machen.
      </ConfirmDialog>
    </section>
  );
}
