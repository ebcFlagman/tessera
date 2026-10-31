'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface HistoryDatum {
  date: string;
  value: number;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });

/** One measure over time as a thin line. Different scales get their own chart, never a second axis. */
export function HistoryChart({
  title,
  data,
  unit,
}: {
  title: string;
  data: HistoryDatum[];
  unit: string;
}) {
  return (
    <section className="panel" aria-label={title}>
      <h2>{title}</h2>
      {data.length === 0 ? (
        <p style={{ color: 'var(--ink-2)' }}>
          Noch kein Verlauf. Die täglichen Stände werden vom Worker geschrieben; der erste entsteht
          beim Start.
        </p>
      ) : (
        <div
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.date} ${d.value} ${unit}`).join(', ')}`}
          style={{ height: 200 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--axis)' }}
                minTickGap={24}
              />
              <YAxis
                width={44}
                allowDecimals={false}
                tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v} ${unit}`, '']}
                separator=""
                labelFormatter={(d: string) =>
                  new Date(`${d}T00:00:00Z`).toLocaleDateString('de-CH')
                }
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--grid)',
                  color: 'var(--ink)',
                }}
                labelStyle={{ color: 'var(--ink)' }}
                itemStyle={{ color: 'var(--ink)' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--series)"
                strokeWidth={2}
                dot={
                  data.length < 15
                    ? { r: 4, fill: 'var(--series)', stroke: 'var(--surface)', strokeWidth: 2 }
                    : false
                }
                activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <details>
        <summary>Als Tabelle anzeigen</summary>
        <table className="data">
          <thead>
            <tr>
              <th>Datum</th>
              <th>{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{new Date(`${d.date}T00:00:00Z`).toLocaleDateString('de-CH')}</td>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
