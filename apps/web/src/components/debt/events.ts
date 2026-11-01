import { statusLabels } from './labels';

interface EventLike {
  type: string;
  changes: Record<string, unknown>;
}

const statusChange = (changes: Record<string, unknown>) => {
  const c = changes.status as
    { from: keyof typeof statusLabels; to: keyof typeof statusLabels } | undefined;
  return c ? `${statusLabels[c.from]} → ${statusLabels[c.to]}` : '';
};

/** One readable line for an entry of a debt's history. */
export function describeEvent(e: EventLike): string {
  switch (e.type) {
    case 'created':
      return 'angelegt';
    case 'imported':
      return 'aus der Quelle importiert';
    case 'updated_by_source':
      return `durch die Quelle aktualisiert (${Object.keys(e.changes).join(', ')})`;
    case 'repaid_by_source':
      return `in Quelle behoben (${statusChange(e.changes)})`;
    case 'reopened_by_source':
      return `in Quelle wieder aufgetaucht, erneut geöffnet (${statusChange(e.changes)})`;
    case 'merged_from':
      return `Duplikat „${String(e.changes.duplicateTitle ?? '')}“ zusammengeführt`;
    case 'merged_into':
      return `als Duplikat zusammengeführt in „${String(e.changes.targetTitle ?? '')}“`;
    case 'status_changed':
      return `Status geändert (${statusChange(e.changes)})`;
    case 'archived':
      return 'archiviert';
    case 'assessed':
      return 'bewertet';
    case 'priority_overridden':
      return 'Priorität überschrieben';
    case 'priority_override_removed':
      return 'Überschreibung entfernt';
    default:
      return `geändert (${Object.keys(e.changes).join(', ')})`;
  }
}
