import type { PrismaClient, User } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { requireAdmin } from '../auth/authorize';
import { writeAudit } from './audit';

const toDto = (t: {
  id: string;
  name: string;
  members: { user: { id: string; name: string } }[];
}) => ({
  id: t.id,
  name: t.name,
  members: t.members
    .map((m) => ({ id: m.user.id, name: m.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
});

const include = { members: { include: { user: { select: { id: true, name: true } } } } } as const;

export async function listTeams(db: PrismaClient) {
  return (await db.team.findMany({ orderBy: { name: 'asc' }, include })).map(toDto);
}

export async function createTeam(db: PrismaClient, actor: User, input: { name: string }) {
  await requireAdmin(db, actor);
  const name = input.name.trim();
  if (await db.team.findUnique({ where: { name } })) {
    throw new AppError('conflict', 'Ein Team mit diesem Namen existiert bereits');
  }
  return db.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name }, include });
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'team.created',
      targetType: 'team',
      targetId: team.id,
      details: { name },
    });
    return toDto(team);
  });
}

/** Replaces the member set of a team; the audit entry lists who was added and removed. */
export async function setTeamMembers(
  db: PrismaClient,
  actor: User,
  teamId: string,
  input: { userIds: string[] },
) {
  await requireAdmin(db, actor);
  const team = await db.team.findUnique({ where: { id: teamId }, include });
  if (!team) throw new AppError('not_found', 'Team nicht gefunden');
  const wanted = [...new Set(input.userIds)];
  const users = await db.user.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  if (users.length !== wanted.length) {
    throw new AppError('validation_failed', 'Mindestens ein Benutzer existiert nicht');
  }
  const current = new Set(team.members.map((m) => m.user.id));
  const added = wanted.filter((id) => !current.has(id));
  const removed = [...current].filter((id) => !wanted.includes(id));

  return db.$transaction(async (tx) => {
    if (removed.length) {
      await tx.teamMember.deleteMany({ where: { teamId, userId: { in: removed } } });
    }
    if (added.length) {
      await tx.teamMember.createMany({ data: added.map((userId) => ({ teamId, userId })) });
    }
    if (added.length || removed.length) {
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'team.members-updated',
        targetType: 'team',
        targetId: teamId,
        details: { name: team.name, added, removed },
      });
    }
    return toDto(await tx.team.findUniqueOrThrow({ where: { id: teamId }, include }));
  });
}
