import { StatusTag } from '../ui/StatusTag';
import { sourceLooks } from './labels';

const typeLabels = { sonarcloud: 'SonarCloud', gitlab: 'GitLab' } as const;

export interface SourceInfo {
  type: keyof typeof typeLabels;
  integrationName: string;
  externalId: string;
  url: string | null;
  lastSeenAt: string;
  gone: boolean;
  findingCount: number;
  conflicts: { field: string; sourceValue?: unknown }[];
}

/** Where an imported debt comes from; manual debts show a plain marker in the compact form. */
export function SourceBadge({
  source,
  detailed = false,
}: {
  source: SourceInfo | null;
  detailed?: boolean;
}) {
  if (!source) {
    return detailed ? (
      <p className="page-empty">Manuell erfasst.</p>
    ) : (
      <StatusTag look={sourceLooks.manual} />
    );
  }
  const label = `${typeLabels[source.type]} · ${source.externalId.replace(/^[a-z]+:/, '')}`;
  const link = source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <span>{label}</span>
  );
  if (!detailed) {
    return (
      <span className="row">
        <StatusTag look={sourceLooks[source.type]} />
        {link}
        {source.gone ? ' (in Quelle behoben)' : ''}
        {source.conflicts.length > 0 ? ' ⚠' : ''}
      </span>
    );
  }
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px' }}>
      <dt>Quelle</dt>
      <dd>
        {link} ({source.integrationName})
      </dd>
      <dt>Letzter Abgleich</dt>
      <dd>{new Date(source.lastSeenAt).toLocaleString('de-CH')}</dd>
      <dt>Befunde</dt>
      <dd>{source.findingCount}</dd>
      {source.gone && (
        <>
          <dt>Stand</dt>
          <dd>In der Quelle behoben</dd>
        </>
      )}
    </dl>
  );
}
