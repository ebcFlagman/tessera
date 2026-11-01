import { gitlab } from './gitlab';
import { sonarcloud } from './sonarcloud';
import type { Connector, ConnectorType } from './types';

export * from './types';
export { isHostAllowed, OFFICIAL_HOSTS } from './http';
export { gitlab, gitlabConfigSchema, type GitlabConfig } from './gitlab';
export { sonarcloud, sonarConfigSchema, parseSonarEffort, type SonarConfig } from './sonarcloud';

export type ConnectorRegistry = (type: ConnectorType) => Connector<unknown>;

const all = { sonarcloud, gitlab } as Record<ConnectorType, Connector<unknown>>;

/** The only place that knows which sources exist. Add new connectors here. */
export const getConnector: ConnectorRegistry = (type) => all[type];
