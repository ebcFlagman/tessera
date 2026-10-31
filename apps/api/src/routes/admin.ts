import { defineRoute } from '../openapi/route';
import { z } from '../openapi/zod';
import { listAuditLog } from '../services/audit-log';
import { listMembers, setMember } from '../services/members';
import { createTeam, listTeams, setTeamMembers } from '../services/teams';
import {
  AuditListSchema,
  AuditQuerySchema,
  IdParams,
  MemberInputSchema,
  MemberSchema,
  TeamInputSchema,
  TeamMembersInputSchema,
  TeamSchema,
} from './schemas';

export const getMembers = defineRoute(
  {
    method: 'get',
    path: '/products/{id}/members',
    summary: 'Rollen eines Produkts',
    tags: ['Verwaltung'],
    params: IdParams,
    success: { status: 200, schema: z.array(MemberSchema), description: 'Mitglieder mit Rolle' },
    errors: [404],
  },
  ({ db, params }) => listMembers(db, params.id),
);

export const putMember = defineRoute(
  {
    method: 'put',
    path: '/products/{id}/members',
    summary: 'Rolle eines Benutzers setzen oder entfernen (Administrator des Produkts)',
    tags: ['Verwaltung'],
    params: IdParams,
    body: MemberInputSchema,
    success: { status: 200, schema: z.array(MemberSchema), description: 'Neue Mitgliederliste' },
    errors: [404, 409],
  },
  ({ db, user, params, body }) => setMember(db, user, params.id, body),
);

export const getAuditLog = defineRoute(
  {
    method: 'get',
    path: '/audit-log',
    summary: 'Änderungsprotokoll (nur Administratoren)',
    tags: ['Verwaltung'],
    query: AuditQuerySchema,
    success: {
      status: 200,
      schema: AuditListSchema,
      description: 'Seite des Protokolls, neueste zuerst',
    },
  },
  ({ db, user, query }) => listAuditLog(db, user, query),
);

export const getTeams = defineRoute(
  {
    method: 'get',
    path: '/teams',
    summary: 'Teams mit Mitgliedern',
    tags: ['Verwaltung'],
    success: { status: 200, schema: z.array(TeamSchema), description: 'Teams' },
  },
  ({ db }) => listTeams(db),
);

export const postTeam = defineRoute(
  {
    method: 'post',
    path: '/teams',
    summary: 'Team anlegen (Administrator)',
    tags: ['Verwaltung'],
    body: TeamInputSchema,
    success: { status: 201, schema: TeamSchema, description: 'Angelegt' },
    errors: [409],
  },
  ({ db, user, body }) => createTeam(db, user, body),
);

export const putTeamMembers = defineRoute(
  {
    method: 'put',
    path: '/teams/{id}/members',
    summary: 'Mitglieder eines Teams festlegen (Administrator)',
    tags: ['Verwaltung'],
    params: IdParams,
    body: TeamMembersInputSchema,
    success: { status: 200, schema: TeamSchema, description: 'Team mit neuen Mitgliedern' },
    errors: [404],
  },
  ({ db, user, params, body }) => setTeamMembers(db, user, params.id, body),
);
