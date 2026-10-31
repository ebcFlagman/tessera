import type { DebtDraft } from '@tessera/domain';
import { z } from 'zod';
import { getJson, MAX_TITLE, trimUrl, truncate } from '../http';
import { ConnectorError, type Connector, type ConnectorContext, type RawFinding } from '../types';

export const gitlabConfigSchema = z.object({
  projectId: z.union([z.string().trim().min(1), z.number().int().positive()]).transform(String),
  baseUrl: z.string().url().default('https://gitlab.com'),
  /** issues with this label are technical/architectural debt */
  label: z.string().trim().min(1).default('tech-debt'),
  /** issues that also carry this label are architectural debt */
  architectureLabel: z.string().trim().min(1).default('architecture'),
});
export type GitlabConfig = z.infer<typeof gitlabConfigSchema>;

const SOURCE = 'GitLab';
const PAGE_SIZE = 100;
const MAX_PAGES = 500;
const SECONDS_PER_DAY = 8 * 3600;

const auth = (ctx: ConnectorContext<GitlabConfig>) => ({ 'private-token': ctx.credentials });
const project = (c: GitlabConfig) =>
  `${trimUrl(c.baseUrl)}/api/v4/projects/${encodeURIComponent(c.projectId)}`;

interface Issue {
  id: number;
  title: string;
  description?: string | null;
  web_url?: string;
  labels?: string[];
  time_stats?: { time_estimate?: number };
}

export const gitlab: Connector<GitlabConfig> = {
  type: 'gitlab',
  configSchema: gitlabConfigSchema,

  async testConnection(ctx) {
    const { body } = await getJson(ctx, project(ctx.config), auth(ctx), SOURCE);
    const name = (body as { name_with_namespace?: string }).name_with_namespace ?? 'Projekt';
    return { ok: true, message: `Verbindung steht, Projekt „${name}“ gefunden` };
  },

  async *fetchFindings(ctx) {
    let page: string | null = '1';
    for (let n = 0; page; n++) {
      if (n >= MAX_PAGES) {
        throw new ConnectorError(
          'PartialData',
          'GitLab liefert zu viele Seiten; Import abgebrochen',
        );
      }
      const qs = new URLSearchParams({
        state: 'opened',
        labels: ctx.config.label,
        per_page: String(PAGE_SIZE),
        page,
      });
      const { body, headers } = await getJson(
        ctx,
        `${project(ctx.config)}/issues?${qs}`,
        auth(ctx),
        SOURCE,
      );
      if (!Array.isArray(body)) {
        throw new ConnectorError('PartialData', 'GitLab lieferte eine unerwartete Antwort');
      }
      const issues = body as Issue[];
      if (issues.length > 0) {
        yield issues.map((i) => ({ externalId: `issue:${i.id}`, payload: i }));
      }
      page = headers.get('x-next-page') || null;
    }
  },

  mapToDebt(finding: RawFinding, config: GitlabConfig): DebtDraft {
    const i = finding.payload as Issue;
    const seconds = i.time_stats?.time_estimate ?? 0;
    return {
      title: truncate(i.title, MAX_TITLE),
      description: i.description ? truncate(i.description, 2000) : null,
      kind: i.labels?.includes(config.architectureLabel) ? 'architectural' : 'technical',
      effortEstimate: seconds > 0 ? Math.round((seconds / SECONDS_PER_DAY) * 100) / 100 : null,
      url: i.web_url ?? null,
    };
  },
};
