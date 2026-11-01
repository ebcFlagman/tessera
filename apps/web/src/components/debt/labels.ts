export const kindLabels = { architectural: 'Architektur', technical: 'Technisch' } as const;

export const statusLabels = {
  open: 'Offen',
  planned: 'Geplant',
  in_progress: 'In Bearbeitung',
  repaid: 'Getilgt',
  accepted: 'Akzeptiert',
} as const;

export type Severity = 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast';

/** Marker shown in front of the text so meaning never depends on colour alone (FR-005). */
export interface TagLook {
  label: string;
  severity: Severity;
  symbol: string;
}

export const statusLooks: Record<keyof typeof statusLabels, TagLook> = {
  open: { label: statusLabels.open, severity: 'warn', symbol: '○' },
  planned: { label: statusLabels.planned, severity: 'info', symbol: '◔' },
  in_progress: { label: statusLabels.in_progress, severity: 'info', symbol: '◑' },
  repaid: { label: statusLabels.repaid, severity: 'success', symbol: '✓' },
  accepted: { label: statusLabels.accepted, severity: 'secondary', symbol: '◇' },
};

export const kindLooks: Record<keyof typeof kindLabels, TagLook> = {
  architectural: { label: kindLabels.architectural, severity: 'contrast', symbol: '▦' },
  technical: { label: kindLabels.technical, severity: 'secondary', symbol: '⚙' },
};

export const priorityBands = ['high', 'medium', 'low', 'none'] as const;
export type PriorityBand = (typeof priorityBands)[number];

export const priorityLooks: Record<PriorityBand, TagLook> = {
  high: { label: 'Hoch', severity: 'danger', symbol: '▲' },
  medium: { label: 'Mittel', severity: 'warn', symbol: '■' },
  low: { label: 'Niedrig', severity: 'info', symbol: '▼' },
  none: { label: 'Ohne', severity: 'secondary', symbol: '–' },
};

export const sourceLooks = {
  manual: { label: 'Manuell', severity: 'secondary', symbol: '✎' },
  sonarcloud: { label: 'SonarCloud', severity: 'info', symbol: '⇩' },
  gitlab: { label: 'GitLab', severity: 'info', symbol: '⇩' },
} as const satisfies Record<string, TagLook>;
