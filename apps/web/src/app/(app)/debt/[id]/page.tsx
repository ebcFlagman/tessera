'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { use } from 'react';
import { DebtForm, type DebtFormValues } from '@/components/debt/DebtForm';
import { statusLabels } from '@/components/debt/labels';
import { ErrorState, Loading } from '@/components/shell/states';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export default function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const ready = useApiReady();
  const qc = useQueryClient();

  const debt = useQuery({
    queryKey: ['debt', id],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/debts/{id}', { params: { path: { id } } })),
  });

  if (debt.isLoading) return <Loading />;
  if (debt.error || !debt.data)
    return <ErrorState message={debt.error?.message ?? 'Nicht gefunden'} />;
  const d = debt.data;

  const initial: DebtFormValues = {
    productId: d.productId,
    title: d.title,
    description: d.description ?? '',
    kind: d.kind,
    status: d.status,
    ownerId: d.ownerId ?? '',
    effortEstimate: d.effortEstimate?.toString() ?? '',
    interestEstimate: d.interestEstimate?.toString() ?? '',
    acceptedReason: d.acceptedReason ?? '',
  };

  return (
    <section>
      <h1>{d.title}</h1>
      <DebtForm
        key={d.updatedAt}
        initial={initial}
        editing
        submitLabel="Speichern"
        onSubmit={async (v) => {
          unwrap(
            await api.PATCH('/debts/{id}', {
              params: { path: { id } },
              body: {
                title: v.title,
                description: v.description,
                kind: v.kind,
                status: v.status,
                ownerId: v.ownerId,
                effortEstimate: v.effortEstimate,
                interestEstimate: v.interestEstimate,
                acceptedReason: v.acceptedReason,
              },
            }),
          );
          await qc.invalidateQueries({ queryKey: ['debt', id] });
          await qc.invalidateQueries({ queryKey: ['debts'] });
        }}
      />
      <h2>Verlauf</h2>
      <ul>
        {d.events.map((e) => (
          <li key={e.id}>
            {new Date(e.at).toLocaleString('de-CH')} – {e.actorName ?? 'System'}:{' '}
            {e.type === 'status_changed'
              ? `Status geändert (${Object.entries(e.changes)
                  .filter(([k]) => k === 'status')
                  .map(([, c]) => {
                    const ch = c as {
                      from: keyof typeof statusLabels;
                      to: keyof typeof statusLabels;
                    };
                    return `${statusLabels[ch.from]} → ${statusLabels[ch.to]}`;
                  })
                  .join(', ')})`
              : e.type === 'created'
                ? 'angelegt'
                : e.type === 'archived'
                  ? 'archiviert'
                  : `geändert (${Object.keys(e.changes).join(', ')})`}
          </li>
        ))}
      </ul>
    </section>
  );
}
