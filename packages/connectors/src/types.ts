import type { DebtDraft } from '@tessera/domain';
import type { ZodTypeAny } from 'zod';

export const connectorTypes = ['sonarcloud', 'gitlab'] as const;
export type ConnectorType = (typeof connectorTypes)[number];

/** What the worker needs from a source. Connectors never touch the database (constitution II). */
export interface ConnectorContext<Config = unknown> {
  config: Config;
  /** access token; only ever passed through, never logged */
  credentials: string;
  http: typeof fetch;
  /** extra hostnames a source may live on (self-hosted installations, tests); see isHostAllowed */
  allowedHosts?: string[];
}

export interface RawFinding {
  /** stable id in the source system */
  externalId: string;
  payload: unknown;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export interface Connector<Config = unknown> {
  readonly type: ConnectorType;
  readonly configSchema: ZodTypeAny;
  testConnection(ctx: ConnectorContext<Config>): Promise<TestResult>;
  /**
   * Lists every currently open finding, page by page. The listing must be complete: if it cannot be
   * (limits, errors) the connector throws instead of returning a partial result, because absent
   * findings are treated as resolved.
   */
  fetchFindings(ctx: ConnectorContext<Config>): AsyncIterable<RawFinding[]>;
  mapToDebt(finding: RawFinding, config: Config): DebtDraft;
}

export type ConnectorErrorKind =
  'Unreachable' | 'InvalidCredentials' | 'InvalidConfig' | 'PartialData' | 'RateLimited';

export class ConnectorError extends Error {
  constructor(
    readonly kind: ConnectorErrorKind,
    message: string,
    /** seconds, for RateLimited */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}
