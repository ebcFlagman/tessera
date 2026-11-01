import type { DebtDraft } from '@tessera/domain';
import { z } from 'zod';
import { getJson, MAX_TITLE, trimUrl, truncate } from '../http';
import { ConnectorError, type Connector, type ConnectorContext, type RawFinding } from '../types';

export const sonarConfigSchema = z.object({
  projectKey: z.string().trim().min(1),
  baseUrl: z.string().url().default('https://sonarcloud.io'),
  /** a synthetic "duplication" finding exists while the density is at or above this percentage */
  duplicationThreshold: z.number().min(0).max(100).default(3),
  includeHotspots: z.boolean().default(true),
});
export type SonarConfig = z.infer<typeof sonarConfigSchema>;

const PAGE_SIZE = 500;
/** SonarCloud's search API refuses to page beyond 10,000 results. */
const MAX_RESULTS = 10_000;

const auth = (ctx: ConnectorContext<SonarConfig>) => ({
  authorization: `Bearer ${ctx.credentials}`,
});
const SOURCE = 'SonarCloud';

/** "1h30min", "2d", "45min" -> person-days (8 h per day). */
export function parseSonarEffort(effort: string | undefined | null): number | null {
  if (!effort) return null;
  const m = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)min)?$/.exec(effort.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const minutes = Number(m[1] ?? 0) * 480 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return Math.round((minutes / 480) * 100) / 100;
}

interface Issue {
  key: string;
  rule?: string;
  severity?: string;
  message?: string;
  component?: string;
  line?: number;
  type?: string;
  effort?: string;
  debt?: string;
  tags?: string[];
}
interface Hotspot {
  key: string;
  message?: string;
  component?: string;
  line?: number;
  vulnerabilityProbability?: string;
}
interface Paging {
  pageIndex: number;
  pageSize: number;
  total: number;
}

async function* paged<T>(
  ctx: ConnectorContext<SonarConfig>,
  path: string,
  query: Record<string, string>,
  pick: (body: unknown) => { items: T[]; paging: Paging },
): AsyncIterable<T[]> {
  const base = trimUrl(ctx.config.baseUrl);
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ ...query, ps: String(PAGE_SIZE), p: String(page) });
    const { body } = await getJson(ctx, `${base}${path}?${qs}`, auth(ctx), SOURCE);
    const { items, paging } = pick(body);
    if (paging.total > MAX_RESULTS) {
      throw new ConnectorError(
        'PartialData',
        `SonarCloud meldet mehr als ${MAX_RESULTS} Befunde; ein vollständiger Import ist nicht möglich. Bitte Projekt eingrenzen.`,
      );
    }
    if (items.length > 0) yield items;
    if (items.length === 0 || page * PAGE_SIZE >= paging.total) return;
  }
}

export const sonarcloud: Connector<SonarConfig> = {
  type: 'sonarcloud',
  configSchema: sonarConfigSchema,

  async testConnection(ctx) {
    const base = trimUrl(ctx.config.baseUrl);
    const qs = new URLSearchParams({
      componentKeys: ctx.config.projectKey,
      resolved: 'false',
      ps: '1',
    });
    const { body } = await getJson(ctx, `${base}/api/issues/search?${qs}`, auth(ctx), SOURCE);
    const total = (body as { paging?: Paging }).paging?.total ?? 0;
    return { ok: true, message: `Verbindung steht, ${total} offene Issues im Projekt` };
  },

  async *fetchFindings(ctx) {
    const { projectKey, baseUrl } = ctx.config;
    for await (const issues of paged<Issue>(
      ctx,
      '/api/issues/search',
      { componentKeys: projectKey, resolved: 'false' },
      (b) => ({
        items: (b as { issues?: Issue[] }).issues ?? [],
        paging: (b as { paging: Paging }).paging,
      }),
    )) {
      yield issues.map((i) => ({ externalId: `issue:${i.key}`, payload: { kind: 'issue', ...i } }));
    }

    if (ctx.config.includeHotspots) {
      for await (const hotspots of paged<Hotspot>(
        ctx,
        '/api/hotspots/search',
        { projectKey, status: 'TO_REVIEW' },
        (b) => ({
          items: (b as { hotspots?: Hotspot[] }).hotspots ?? [],
          paging: (b as { paging: Paging }).paging,
        }),
      )) {
        yield hotspots.map((h) => ({
          externalId: `hotspot:${h.key}`,
          payload: { kind: 'hotspot', ...h },
        }));
      }
    }

    const qs = new URLSearchParams({
      component: projectKey,
      metricKeys: 'duplicated_lines_density',
    });
    const { body } = await getJson(
      ctx,
      `${trimUrl(baseUrl)}/api/measures/component?${qs}`,
      auth(ctx),
      SOURCE,
    );
    const measure = (
      body as { component?: { measures?: { metric: string; value?: string }[] } }
    ).component?.measures?.find((m) => m.metric === 'duplicated_lines_density');
    const density = Number(measure?.value);
    if (Number.isFinite(density) && density >= ctx.config.duplicationThreshold) {
      yield [
        { externalId: `duplication:${projectKey}`, payload: { kind: 'duplication', density } },
      ];
    }
  },

  mapToDebt(finding: RawFinding, config: SonarConfig): DebtDraft {
    const p = finding.payload as Record<string, unknown> & { kind: string };
    const base = trimUrl(config.baseUrl);
    const where = (c?: unknown, line?: unknown) =>
      c ? `${String(c)}${line ? `:${String(line)}` : ''}` : config.projectKey;

    if (p.kind === 'duplication') {
      return {
        title: `Codeduplikation ${p.density}% in ${config.projectKey}`,
        description: `Der Anteil duplizierter Zeilen liegt bei ${p.density}% (Schwelle ${config.duplicationThreshold}%).`,
        kind: 'technical',
        effortEstimate: null,
        url: `${base}/component_measures?id=${encodeURIComponent(config.projectKey)}&metric=duplicated_lines_density`,
      };
    }
    if (p.kind === 'hotspot') {
      return {
        title: truncate(`Security Hotspot: ${String(p.message ?? 'ohne Beschreibung')}`, MAX_TITLE),
        description: `Zu prüfen (Wahrscheinlichkeit ${String(p.vulnerabilityProbability ?? 'unbekannt')}) in ${where(p.component, p.line)}.`,
        kind: 'technical',
        effortEstimate: null,
        url: `${base}/security_hotspots?id=${encodeURIComponent(config.projectKey)}&hotspots=${String(p.key)}`,
      };
    }
    const tags = (p.tags as string[] | undefined) ?? [];
    return {
      title: truncate(String(p.message ?? p.rule ?? 'Issue ohne Beschreibung'), MAX_TITLE),
      description: `Regel ${String(p.rule ?? '?')}, Schweregrad ${String(p.severity ?? '?')}, ${where(p.component, p.line)}.`,
      kind: tags.some((t) => /architect/i.test(t)) ? 'architectural' : 'technical',
      effortEstimate: parseSonarEffort((p.effort ?? p.debt) as string | undefined),
      url: `${base}/project/issues?id=${encodeURIComponent(config.projectKey)}&open=${String(p.key)}`,
    };
  },
};
