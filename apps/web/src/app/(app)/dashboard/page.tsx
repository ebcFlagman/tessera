'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarList } from '@/components/dashboard/BarList';
import { HistoryChart } from '@/components/dashboard/HistoryChart';
import { StatTile } from '@/components/dashboard/StatTile';
import { DashboardTheme } from '@/components/dashboard/theme';
import { kindLabels, statusLabels } from '@/components/debt/labels';
import { ExportButton } from '@/components/export/ExportButton';
import { ErrorState, Loading } from '@/components/shell/states';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
import { unwrap, useApi, useApiReady } from '@/lib/api';

const RANGES = { '30': '30 Tage', '90': '90 Tage', '180': '180 Tage', '365': '1 Jahr' } as const;
type Range = keyof typeof RANGES;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (n: number) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 }).format(n);

export default function DashboardPage() {
  const api = useApi();
  const ready = useApiReady();
  const [productId, setProductId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [range, setRange] = useState<Range>('90');

  const to = new Date();
  const from = new Date(to.getTime() - (Number(range) - 1) * 86_400_000);
  const query = {
    ...(productId ? { productId } : {}),
    ...(teamId ? { teamId } : {}),
    from: isoDay(from),
    to: isoDay(to),
  };

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });
  const teams = useQuery({
    queryKey: ['teams'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/teams')),
  });
  const data = useQuery({
    queryKey: ['dashboard', query],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/dashboard', { params: { query } })),
  });

  const m = data.data?.current;
  return (
    <section className="viz-root">
      <DashboardTheme />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="row" style={{ marginLeft: 'auto' }}>
          <ExportButton kind="dashboard" query={query} label="Kennzahlen als CSV" />{' '}
          <ExportButton
            kind="debts"
            query={{ productId: productId || undefined, teamId: teamId || undefined }}
            label="Register als CSV"
          />
        </span>
      </div>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="toolbar"
        style={{ margin: '12px 0 16px' }}
      >
        <FormField id="dash-product" label="Produkt">
          {({ id }) => (
            <SelectField
              id={id}
              value={productId}
              options={[
                { value: '', label: 'alle' },
                ...(products.data ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
              placeholder="alle"
              onChange={setProductId}
            />
          )}
        </FormField>
        <FormField id="dash-team" label="Team">
          {({ id }) => (
            <SelectField
              id={id}
              value={teamId}
              options={[
                { value: '', label: 'alle' },
                ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name })),
              ]}
              placeholder="alle"
              onChange={setTeamId}
            />
          )}
        </FormField>
        <FormField id="dash-range" label="Zeitraum">
          {({ id }) => (
            <SelectField
              id={id}
              value={range}
              options={Object.entries(RANGES).map(([value, label]) => ({ value, label }))}
              onChange={(v) => setRange(v as Range)}
            />
          )}
        </FormField>
      </form>

      {data.isLoading && <Loading />}
      {data.error && <ErrorState message={data.error.message} />}
      {data.data && m && (
        <>
          <div className="tile-grid" style={{ marginBottom: 16 }}>
            <StatTile label="Schulden gesamt" value={fmt(m.total)} hint="ohne archivierte" />
            <StatTile
              label="Davon offen"
              value={fmt(m.openCount)}
              hint="offen, geplant, in Bearbeitung"
            />
            <StatTile
              label="Offener Aufwand (PT)"
              value={`${m.unestimatedOpen > 0 ? '≥ ' : ''}${fmt(m.openEffort)}`}
              hint={
                m.unestimatedOpen > 0
                  ? `${m.unestimatedOpen} offene Schulden ohne Schätzung`
                  : 'Personentage'
              }
            />
            <StatTile
              label="Folgekosten (PT/Monat)"
              value={fmt(m.openInterest)}
              hint="offene Schulden"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            <BarList
              title="Nach Status"
              data={(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map((k) => ({
                key: k,
                label: statusLabels[k],
                value: m.byStatus[k],
              }))}
            />
            <BarList
              title="Nach Art"
              data={(Object.keys(kindLabels) as (keyof typeof kindLabels)[]).map((k) => ({
                key: k,
                label: kindLabels[k],
                value: m.byKind[k],
              }))}
            />
            <BarList
              title="Nach Priorität"
              data={[
                {
                  key: 'high',
                  label: 'Hoch (ab 70)',
                  value: m.byPriorityBand.high,
                  color: 'var(--band-high)',
                },
                {
                  key: 'medium',
                  label: 'Mittel (ab 40)',
                  value: m.byPriorityBand.medium,
                  color: 'var(--band-medium)',
                },
                {
                  key: 'low',
                  label: 'Niedrig',
                  value: m.byPriorityBand.low,
                  color: 'var(--band-low)',
                },
                {
                  key: 'none',
                  label: 'Nicht bewertet',
                  value: m.byPriorityBand.unassessed,
                  color: 'var(--band-none)',
                },
              ]}
            />
          </div>

          <h2 style={{ margin: '20px 0 8px' }}>Verlauf</h2>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            }}
          >
            <HistoryChart
              title="Offene Schulden"
              unit="Schulden"
              data={data.data.history.map((h) => ({ date: h.date, value: h.openCount }))}
            />
            <HistoryChart
              title="Offener Aufwand"
              unit="Personentage"
              data={data.data.history.map((h) => ({ date: h.date, value: h.openEffort }))}
            />
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: '0.85rem' }}>
            Stand der Kennzahlen: {new Date(data.data.generatedAt).toLocaleString('de-CH')}. Verlauf
            aus den täglichen Ständen
            {data.data.lastSnapshotDate ? ` (zuletzt ${data.data.lastSnapshotDate})` : ''}.
          </p>
        </>
      )}
    </section>
  );
}
