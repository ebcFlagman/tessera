import type { Prisma, PrismaClient } from '@tessera/db';
import { redact } from '../lib/logger';

type Tx = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

/** Appends an audit entry; details are redacted so secrets can never be stored. */
export async function writeAudit(db: Tx, input: AuditInput): Promise<void> {
  await db.auditEntry.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      details: redact(input.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}
