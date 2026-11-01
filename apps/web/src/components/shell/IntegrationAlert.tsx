'use client';

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
    <div
      role="alert"
      data-testid="integration-alert"
      style={{ background: '#fdecea', border: '1px solid #b00020', padding: 12, marginBottom: 16 }}
    >
      <strong>Eine Integration braucht deine Aufmerksamkeit.</strong>
      <ul style={{ margin: '4px 0' }}>
        {failing.data.map((i) => (
          <li key={i.id}>
            {i.name}: {i.lastError ?? 'Fehler beim Import'}
          </li>
        ))}
      </ul>
      <Link href="/integrations">Zu den Integrationen</Link>
    </div>
  );
}
