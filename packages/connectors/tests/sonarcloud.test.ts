import { describe, expect, it } from 'vitest';
import { ConnectorError, parseSonarEffort, sonarcloud, sonarConfigSchema } from '../src';
import { collect, ctx, fakeHttp, fixture } from './helpers';

const config = sonarConfigSchema.parse({ projectKey: 'demo' });

describe('parseSonarEffort', () => {
  it('converts to person-days (8 h per day)', () => {
    expect(parseSonarEffort('30min')).toBe(0.06);
    expect(parseSonarEffort('1h30min')).toBe(0.19);
    expect(parseSonarEffort('2d')).toBe(2);
    expect(parseSonarEffort('1d4h')).toBe(1.5);
    expect(parseSonarEffort(undefined)).toBeNull();
    expect(parseSonarEffort('???')).toBeNull();
  });
});

describe('sonarcloud connector', () => {
  const happy = () =>
    fakeHttp([
      { match: '/api/issues/search', body: fixture('sonar-issues-page1.json') },
      { match: '/api/hotspots/search', body: fixture('sonar-hotspots.json') },
      { match: '/api/measures/component', body: fixture('sonar-measures-high.json') },
    ]);

  it('lists issues, hotspots and duplication with stable external ids', async () => {
    const { http, requests } = happy();
    const findings = await collect(sonarcloud.fetchFindings(ctx(config, http)));
    expect(findings.map((f) => f.externalId)).toEqual([
      'issue:AX1',
      'issue:AX2',
      'issue:AX3',
      'hotspot:HS1',
      'duplication:demo',
    ]);
    expect(requests.every((r) => r.headers.authorization === 'Bearer geheimes-token')).toBe(true);
    expect(requests[0]?.url).toContain('resolved=false');
  });

  it('maps findings to debt drafts', async () => {
    const { http } = happy();
    const findings = await collect(sonarcloud.fetchFindings(ctx(config, http)));
    const drafts = Object.fromEntries(
      findings.map((f) => [f.externalId, sonarcloud.mapToDebt(f, config)]),
    );
    expect(drafts['issue:AX1']).toMatchObject({
      title: 'Cognitive Complexity von 31 reduzieren',
      kind: 'technical',
      effortEstimate: 0.19,
    });
    expect(drafts['issue:AX1']?.url).toContain('open=AX1');
    expect(drafts['issue:AX2']?.effortEstimate).toBe(0.06); // falls back to "debt"
    expect(drafts['issue:AX3']).toMatchObject({ kind: 'architectural', effortEstimate: 2 });
    expect(drafts['hotspot:HS1']?.title).toMatch(/^Security Hotspot:/);
    expect(drafts['duplication:demo']?.title).toContain('7.4%');
  });

  it('omits the duplication finding below the threshold, and hotspots when disabled', async () => {
    const { http } = fakeHttp([
      { match: '/api/issues/search', body: fixture('sonar-issues-page1.json') },
      { match: '/api/measures/component', body: fixture('sonar-measures-low.json') },
    ]);
    const cfg = sonarConfigSchema.parse({ projectKey: 'demo', includeHotspots: false });
    const ids = (await collect(sonarcloud.fetchFindings(ctx(cfg, http)))).map((f) => f.externalId);
    expect(ids).toEqual(['issue:AX1', 'issue:AX2', 'issue:AX3']);
  });

  it('follows pagination until the total is reached', async () => {
    const issue = (key: string) => ({
      key,
      message: key,
      rule: 'r',
      severity: 'MINOR',
      component: 'c',
    });
    const calls: string[] = [];
    const http = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/api/issues/search')) {
        const page = Number(new URL(url).searchParams.get('p'));
        const issues =
          page === 1 ? Array.from({ length: 500 }, (_, i) => issue(`a${i}`)) : [issue('b0')];
        return Response.json({ paging: { pageIndex: page, pageSize: 500, total: 501 }, issues });
      }
      return Response.json({ component: { measures: [] } });
    }) as typeof fetch;
    const cfg = sonarConfigSchema.parse({ projectKey: 'demo', includeHotspots: false });
    const all = await collect(sonarcloud.fetchFindings(ctx(cfg, http)));
    expect(all).toHaveLength(501);
    expect(calls.filter((c) => c.includes('/api/issues/search'))).toHaveLength(2);
  });

  it('fails instead of returning a partial listing above the 10,000 result limit', async () => {
    const { http } = fakeHttp([
      {
        match: '/api/issues/search',
        body: { paging: { pageIndex: 1, pageSize: 500, total: 10001 }, issues: [{ key: 'x' }] },
      },
    ]);
    await expect(collect(sonarcloud.fetchFindings(ctx(config, http)))).rejects.toMatchObject({
      kind: 'PartialData',
    });
  });

  it.each([
    [401, 'InvalidCredentials'],
    [403, 'InvalidCredentials'],
    [404, 'InvalidConfig'],
    [500, 'Unreachable'],
  ] as const)('maps HTTP %i to %s without leaking the token', async (status, kind) => {
    const { http } = fakeHttp([{ match: '/api/issues/search', status }]);
    const err = await collect(sonarcloud.fetchFindings(ctx(config, http))).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.kind).toBe(kind);
    expect(err.message).not.toContain('geheimes-token');
  });

  it('reports rate limits with retryAfter', async () => {
    const { http } = fakeHttp([
      { match: '/api/issues/search', status: 429, headers: { 'retry-after': '120' } },
    ]);
    await expect(collect(sonarcloud.fetchFindings(ctx(config, http)))).rejects.toMatchObject({
      kind: 'RateLimited',
      retryAfter: 120,
    });
  });

  it('refuses hosts that are not allowed (SSRF protection) unless explicitly granted', async () => {
    const { http, requests } = fakeHttp([
      { match: '/api/issues/search', body: { paging: { total: 0 } } },
    ]);
    const internal = sonarConfigSchema.parse({
      projectKey: 'demo',
      baseUrl: 'http://169.254.169.254',
    });
    await expect(sonarcloud.testConnection(ctx(internal, http))).rejects.toMatchObject({
      kind: 'InvalidConfig',
    });
    expect(requests).toHaveLength(0); // nothing was requested
    const local = sonarConfigSchema.parse({ projectKey: 'demo', baseUrl: 'http://localhost:4010' });
    await expect(sonarcloud.testConnection(ctx(local, http))).rejects.toMatchObject({
      kind: 'InvalidConfig',
    });
    const granted = { ...ctx(local, http), allowedHosts: ['localhost'] };
    await expect(sonarcloud.testConnection(granted)).resolves.toMatchObject({ ok: true });
  });

  it('reports an unreachable source', async () => {
    const { http } = fakeHttp([{ match: 'sonarcloud', fail: true }]);
    await expect(sonarcloud.testConnection(ctx(config, http))).rejects.toMatchObject({
      kind: 'Unreachable',
    });
  });

  it('testConnection reports the number of open issues', async () => {
    const { http } = fakeHttp([{ match: '/api/issues/search', body: { paging: { total: 42 } } }]);
    expect(await sonarcloud.testConnection(ctx(config, http))).toMatchObject({
      ok: true,
      message: expect.stringContaining('42'),
    });
  });
});
