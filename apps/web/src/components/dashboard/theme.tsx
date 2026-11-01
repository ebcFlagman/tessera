/**
 * Chart colours as CSS variables. Surfaces, text and grid lines come from the theme preset's
 * tokens so charts follow light and dark with the rest of the app; the series hues are a
 * separate, ordered blue ramp chosen for both modes (not an inversion).
 */
export function DashboardTheme() {
  return (
    <style>{`
      .viz-root {
        --surface: var(--p-content-background);
        --ink: var(--p-text-color);
        --ink-2: var(--p-text-muted-color);
        --ink-muted: var(--p-text-muted-color);
        --grid: var(--p-content-border-color);
        --axis: var(--p-content-border-color);
        --series: #2a78d6;
        --band-high: #184f95;
        --band-medium: #3987e5;
        --band-low: #86b6ef;
        --band-none: #898781;
        color: var(--ink);
      }
      :root[data-theme='dark'] .viz-root {
        --series: #3987e5;
        --band-high: #9ec5f4;
        --band-medium: #3987e5;
        --band-low: #1c5cab;
      }
      .viz-root .panel { border: 1px solid var(--grid); border-radius: var(--p-border-radius-md, 8px); padding: 12px 16px; background: var(--surface); }
      .viz-root .panel h2 { font-size: 1rem; margin: 0 0 8px; }
      .viz-root table.data { border-collapse: collapse; font-variant-numeric: tabular-nums; }
      .viz-root table.data th, .viz-root table.data td { text-align: left; padding: 2px 12px 2px 0; }
      .viz-root details summary { color: var(--ink-2); cursor: pointer; font-size: 0.85rem; margin-top: 8px; }
    `}</style>
  );
}
