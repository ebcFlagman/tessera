'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { use } from 'react';
import { AssessmentPanel } from '@/components/debt/AssessmentPanel';
import { DebtForm, type DebtFormValues } from '@/components/debt/DebtForm';
import { PriorityOverride } from '@/components/debt/PriorityOverride';
import { describeEvent } from '@/components/debt/events';
import { MergeDuplicates, ConflictNotice } from '@/components/debt/MergeDuplicates';
import { SourceBadge } from '@/components/debt/SourceBadge';
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
      <h2>Herkunft</h2>
      <SourceBadge source={d.source} detailed />
      <ConflictNotice source={d.source} />
      <PriorityOverride debtId={id} priority={d} />
      <AssessmentPanel debtId={id} />
      <MergeDuplicates debtId={id} productId={d.productId} />
      <h2>Verlauf</h2>
      <ul>
        {d.events.map((e) => (
          <li key={e.id}>
            {new Date(e.at).toLocaleString('de-CH')} – {e.actorName ?? 'System'}: {describeEvent(e)}
          </li>
        ))}
      </ul>
    </section>
  );
}
