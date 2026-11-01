'use client';

import { Message } from '@primereact/ui/message';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { unwrap, useApi, useApiReady } from '@/lib/api';

/** Visible notice for administrators when an integration fails (e.g. expired credentials). */
export function IntegrationAlert() {
  const api = useApi();
  const ready = useApiReady();
  const failing = useQuery({
    queryKey: ['integrations', 'attention'],
    enabled: ready,
    refetchInterval: 15_000,
    queryFn: async () =>
      unwrap(await api.GET('/integrations', { params: { query: { status: 'error' } } })),
  });
  if (!failing.data || failing.data.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }} data-testid="integration-alert">
      <Message.Root severity="error" role="alert">
        <Message.Content>
          <Message.Icon />
          <Message.Text>
            <strong>Eine Integration braucht deine Aufmerksamkeit.</strong>
            <span style={{ display: 'block', margin: '4px 0' }}>
              {failing.data.map((i) => (
                <span key={i.id} style={{ display: 'block' }}>
                  {i.name}: {i.lastError ?? 'Fehler beim Import'}
                </span>
              ))}
            </span>
            <Link href="/integrations">Zu den Integrationen</Link>
          </Message.Text>
        </Message.Content>
      </Message.Root>
    </div>
  );
}
