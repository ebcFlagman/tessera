'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DebtForm, emptyDebt } from '@/components/debt/DebtForm';
import { notify } from '@/components/ui/Notifier';
import { unwrap, useApi } from '@/lib/api';

export default function NewDebtPage() {
  const api = useApi();
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <section className="stack">
      <h1>Schuld erfassen</h1>
      <DebtForm
        initial={emptyDebt}
        editing={false}
        submitLabel="Anlegen"
        onSubmit={async (v) => {
          const created = unwrap(
            await api.POST('/debts', {
              body: {
                productId: v.productId,
                title: v.title,
                description: v.description,
                kind: v.kind,
                ownerId: v.ownerId,
                teamId: v.teamId,
                effortEstimate: v.effortEstimate,
                interestEstimate: v.interestEstimate,
              },
            }),
          );
          await qc.invalidateQueries({ queryKey: ['debts'] });
          notify.success('Schuld angelegt');
          router.push(`/debt/${created.id}`);
        }}
      />
    </section>
  );
}
