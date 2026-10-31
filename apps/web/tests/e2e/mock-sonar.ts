import { createServer, type Server } from 'node:http';

export interface MockIssue {
  key: string;
  message: string;
}

/**
 * Minimal stand-in for the SonarCloud web API (issues, hotspots, measures) on localhost.
 * Tessera must be started with SOURCE_ALLOWED_HOSTS=localhost to talk to it.
 */
export class MockSonar {
  issues: MockIssue[] = [];
  requests = 0;
  private server: Server | undefined;

  constructor(readonly token: string) {}

  async start(port: number): Promise<void> {
    this.server = createServer((req, res) => {
      this.requests++;
      const url = new URL(req.url ?? '/', 'http://localhost');
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.headers.authorization !== `Bearer ${this.token}`)
        return send(401, { errors: [{ msg: 'unauthorized' }] });
      if (url.pathname === '/api/issues/search') {
        return send(200, {
          paging: { pageIndex: 1, pageSize: 500, total: this.issues.length },
          issues: this.issues.map((i) => ({
            key: i.key,
            rule: 'java:S3776',
            severity: 'MAJOR',
            message: i.message,
            component: 'demo:src/Order.java',
            line: 10,
            type: 'CODE_SMELL',
            effort: '1h',
            tags: [],
          })),
        });
      }
      if (url.pathname === '/api/hotspots/search') {
        return send(200, { paging: { pageIndex: 1, pageSize: 500, total: 0 }, hotspots: [] });
      }
      if (url.pathname === '/api/measures/component') {
        return send(200, {
          component: { measures: [{ metric: 'duplicated_lines_density', value: '0.5' }] },
        });
      }
      return send(404, {});
    });
    await new Promise<void>((resolve) => this.server!.listen(port, resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }
}
