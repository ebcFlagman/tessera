/**
 * Chart colours as CSS variables (reference palette: blue sequential ramp, neutral ink, recessive grid).
 */
export function DashboardTheme() {
  return (
    <style>{`
      .viz-root {
        color-scheme: light;
        --surface: #fcfcfb;
        --ink: #0b0b0b;
        --ink-2: #52514e;
        --ink-muted: #898781;
        --grid: #e1e0d9;
        --axis: #c3c2b7;
        --series: #2a78d6;
        --band-high: #184f95;
        --band-medium: #3987e5;
        --band-low: #86b6ef;
        --band-none: #898781;
        background: var(--surface);
        color: var(--ink);
      }
      /* Dark values are prepared (own selection of the same hues, not an inversion). They only
         apply with an explicit data-theme="dark" until the whole app has a dark theme; otherwise
         the dashboard would be a dark island on a light page. */
      :root[data-theme='dark'] .viz-root {
        color-scheme: dark;
        --surface: #1a1a19;
        --ink: #f0efec;
        --ink-2: #c3c2b7;
        --grid: #2c2c2a;
        --axis: #383835;
        --series: #3987e5;
        --band-high: #9ec5f4;
        --band-medium: #3987e5;
        --band-low: #1c5cab;
      }
      .viz-root .tile { border: 1px solid var(--grid); padding: 12px 16px; border-radius: 8px; min-width: 150px; }
      .viz-root .tile .value { font-size: 2rem; font-weight: 600; line-height: 1.1; }
      .viz-root .tile .label { color: var(--ink-2); font-size: 0.85rem; }
      .viz-root .tile .hint { color: var(--ink-2); font-size: 0.75rem; }
      .viz-root .panel { border: 1px solid var(--grid); border-radius: 8px; padding: 12px 16px; }
      .viz-root .panel h2 { font-size: 1rem; margin: 0 0 8px; }
      .viz-root table.data { border-collapse: collapse; font-variant-numeric: tabular-nums; }
      .viz-root table.data th, .viz-root table.data td { text-align: left; padding: 2px 12px 2px 0; }
      .viz-root details summary { color: var(--ink-2); cursor: pointer; font-size: 0.85rem; margin-top: 8px; }
    `}</style>
  );
}
