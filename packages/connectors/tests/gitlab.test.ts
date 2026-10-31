import { describe, expect, it } from 'vitest';
import { gitlab, gitlabConfigSchema } from '../src';
import { collect, ctx, fakeHttp, fixture } from './helpers';

const config = gitlabConfigSchema.parse({ projectId: 4711 });

describe('gitlab connector', () => {
  it('validates and defaults the configuration', () => {
    expect(config).toMatchObject({
      projectId: '4711',
      label: 'tech-debt',
      baseUrl: 'https://gitlab.com',
    });
    expect(() => gitlabConfigSchema.parse({})).toThrow();
  });

  it('follows x-next-page and maps issues', async () => {
    const calls: string[] = [];
    const http = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const page = new URL(url).searchParams.get('page');
      return page === '1'
        ? Response.json(fixture('gitlab-issues-page1.json'), { headers: { 'x-next-page': '2' } })
        : Response.json(fixture('gitlab-issues-page2.json'), { headers: { 'x-next-page': '' } });
    }) as typeof fetch;

    const findings = await collect(gitlab.fetchFindings(ctx(config, http)));
    expect(findings.map((f) => f.externalId)).toEqual(['issue:9001', 'issue:9002', 'issue:9003']);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/api/v4/projects/4711/issues');
    expect(calls[0]).toContain('state=opened');
    expect(calls[0]).toContain('labels=tech-debt');

    const drafts = findings.map((f) => gitlab.mapToDebt(f, config));
    expect(drafts[0]).toMatchObject({
      title: 'Monolith-Modul Abrechnung entkoppeln',
      kind: 'architectural',
      effortEstimate: 5, // 144000 s = 5 person-days
      url: 'https://gitlab.com/acme/shop/-/issues/1',
    });
    expect(drafts[1]).toMatchObject({ kind: 'technical', effortEstimate: null, description: null });
    expect(drafts[2]?.effortEstimate).toBe(1);
  });

  it('authenticates with the private token header', async () => {
    const { http, requests } = fakeHttp([{ match: '/issues', body: [] }]);
    await collect(gitlab.fetchFindings(ctx(config, http)));
    expect(requests[0]?.headers['private-token']).toBe('geheimes-token');
  });

  it('truncates very long titles', () => {
    const draft = gitlab.mapToDebt(
      { externalId: 'issue:1', payload: { id: 1, title: 'x'.repeat(500), labels: [] } },
      config,
    );
    expect(draft.title).toHaveLength(200);
  });

  it.each([
    [401, 'InvalidCredentials'],
    [404, 'InvalidConfig'],
    [503, 'Unreachable'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const { http } = fakeHttp([{ match: '/api/v4', status }]);
    const err = await gitlab.testConnection(ctx(config, http)).catch((e) => e);
    expect(err.kind).toBe(kind);
    expect(err.message).not.toContain('geheimes-token');
  });

  it('reports rate limits with retryAfter (default 60 s)', async () => {
    const { http } = fakeHttp([
      { match: '/issues', status: 429, headers: { 'retry-after': '30' } },
    ]);
    await expect(collect(gitlab.fetchFindings(ctx(config, http)))).rejects.toMatchObject({
      kind: 'RateLimited',
      retryAfter: 30,
    });
    const { http: http2 } = fakeHttp([{ match: '/issues', status: 429 }]);
    await expect(collect(gitlab.fetchFindings(ctx(config, http2)))).rejects.toMatchObject({
      retryAfter: 60,
    });
  });

  it('rejects an unexpected (non-array) issue response instead of treating it as empty', async () => {
    const { http } = fakeHttp([{ match: '/issues', body: { message: 'oops' } }]);
    await expect(collect(gitlab.fetchFindings(ctx(config, http)))).rejects.toMatchObject({
      kind: 'PartialData',
    });
  });

  it('testConnection names the project', async () => {
    const { http } = fakeHttp([
      { match: '/api/v4/projects/4711', body: { name_with_namespace: 'acme / shop' } },
    ]);
    expect(await gitlab.testConnection(ctx(config, http))).toMatchObject({
      ok: true,
      message: expect.stringContaining('acme / shop'),
    });
  });
});
