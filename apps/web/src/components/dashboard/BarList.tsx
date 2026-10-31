'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** CSS colour, usually a `var(--…)` from the dashboard theme */
  color?: string;
}

/**
 * Horizontal bars for comparing counts. One hue (or an ordered ramp via `color`), thin bars with
 * rounded ends, the value written at the end of each bar, and the same numbers as a table.
 */
export function BarList({
  title,
  data,
  unit = 'Schulden',
}: {
  title: string;
  data: BarDatum[];
  unit?: string;
}) {
  const summary = data.map((d) => `${d.label}: ${d.value}`).join(', ');
  return (
    <section className="panel" aria-label={title}>
      <h2>{title}</h2>
      <div role="img" aria-label={`${title}. ${summary}`} style={{ height: 36 * data.length + 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fill: 'var(--ink-2)', fontSize: 13 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--grid)', opacity: 0.5 }}
              formatter={(v: number) => [`${v} ${unit}`, '']}
              separator=""
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--grid)',
                color: 'var(--ink)',
              }}
              labelStyle={{ color: 'var(--ink)' }}
              itemStyle={{ color: 'var(--ink)' }}
            />
            <Bar dataKey="value" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color ?? 'var(--series)'} />
              ))}
              <LabelList dataKey="value" position="right" fill="var(--ink)" fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>Als Tabelle anzeigen</summary>
        <table className="data">
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
