'use client';

import { Button } from '@primereact/ui/button';
import { useState } from 'react';
import { notify } from '@/components/ui/Notifier';
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
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outlined"
      disabled={busy || !ready}
      onClick={async () => {
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
            /filename="([^"]+)"/.exec(res.response.headers.get('content-disposition') ?? '')?.[1] ??
            'export.csv';
          const url = URL.createObjectURL(res.data as Blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          notify.success('Export heruntergeladen', filename);
        } catch (err) {
          notify.error('Export fehlgeschlagen', err instanceof Error ? err.message : undefined);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Exportiert …' : label}
    </Button>
  );
}
