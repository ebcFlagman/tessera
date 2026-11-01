'use client';

import { useState } from 'react';
import { useApi, useApiReady } from '@/lib/api';

type Query = Record<string, string | undefined>;
const clean = (q: Query) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v)) as Record<string, string>;

/** Downloads a CSV through the generated API client (the file the user sees is what the API returns). */
export function ExportButton({
  kind,
  query,
  label,
}: {
  kind: 'debts' | 'dashboard';
  query: Query;
  label: string;
}) {
  const api = useApi();
  const ready = useApiReady();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <span>
      <button
        type="button"
        disabled={busy || !ready}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const q = clean(query);
            const res =
              kind === 'debts'
                ? await api.GET('/exports/debts', {
                    params: { query: q as never },
                    parseAs: 'blob',
                  })
                : await api.GET('/exports/dashboard', {
                    params: { query: q as never },
                    parseAs: 'blob',
                  });
            if (!res.data) {
              throw new Error(
                (res.error as { message?: string } | undefined)?.message ?? 'Export fehlgeschlagen',
              );
            }
            const filename =
              /filename="([^"]+)"/.exec(
                res.response.headers.get('content-disposition') ?? '',
              )?.[1] ?? 'export.csv';
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Export fehlgeschlagen');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Exportiert …' : label}
      </button>
      {error && (
        <span role="alert" style={{ color: '#b00020', marginLeft: 8 }}>
          {error}
        </span>
      )}
    </span>
  );
}
