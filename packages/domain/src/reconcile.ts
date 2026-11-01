import { createHash } from 'node:crypto';
import type { DebtKind, DebtStatus } from './debt-status';

/** Fields an import may write. Anything else (owner, status, priority, …) is never touched. */
export const sourceFields = ['title', 'description', 'kind', 'effortEstimate'] as const;
export type SourceField = (typeof sourceFields)[number];

export interface DebtDraft {
  title: string;
  description: string | null;
  kind: DebtKind;
  /** person-days */
  effortEstimate: number | null;
  /** link to the finding in the source system */
  url: string | null;
}

export interface Incoming {
  externalId: string;
  draft: DebtDraft;
}

export interface ExistingFinding {
  externalId: string;
  debtId: string;
  goneAt: Date | null;
  firstSeenAt: Date;
  fingerprint: string;
}

export interface ExistingDebt {
  id: string;
  status: DebtStatus;
  /** field -> "source" | "manual" */
  fieldOrigin: Record<string, string>;
  title: string;
  description: string | null;
  kind: DebtKind;
  effortEstimate: number | null;
}

export interface Conflict {
  field: SourceField;
  sourceValue: unknown;
}

export interface ReconcilePlan {
  create: { externalId: string; draft: DebtDraft; fingerprint: string }[];
  /** present findings: bookkeeping, no matter whether the debt changed */
  touch: { externalId: string; fingerprint: string; conflicts: Conflict[] }[];
  update: {
    debtId: string;
    patch: Partial<Pick<DebtDraft, SourceField>>;
    changes: Record<string, { from: unknown; to: unknown }>;
  }[];
  markGone: string[];
  /** every finding of the debt is gone: "Quelle getilgt gewinnt", also over a manual status */
  repay: { debtId: string; previousStatus: DebtStatus }[];
  /** a finding of a repaid debt is back */
  reopen: { debtId: string }[];
  counts: { created: number; updated: number; repaid: number; reopened: number; unchanged: number };
}

export function fingerprintOf(draft: DebtDraft): string {
  return createHash('sha256').update(JSON.stringify(draft)).digest('hex').slice(0, 32);
}

/**
 * Pure planning step of an import run. The caller executes the plan in one transaction, and only
 * after the source listing was fetched completely: a partial listing must never reach this
 * function, otherwise unlisted findings would wrongly be treated as gone.
 */
export function reconcile(input: {
  findings: ExistingFinding[];
  debts: Map<string, ExistingDebt>;
  incoming: Incoming[];
}): ReconcilePlan {
  const incoming = new Map(input.incoming.map((i) => [i.externalId, i]));
  const existing = new Map(input.findings.map((f) => [f.externalId, f]));

  // the oldest finding of a debt drives its source fields
  const primary = new Map<string, string>();
  for (const f of [...input.findings].sort(
    (a, b) =>
      a.firstSeenAt.getTime() - b.firstSeenAt.getTime() || a.externalId.localeCompare(b.externalId),
  )) {
    if (!primary.has(f.debtId)) primary.set(f.debtId, f.externalId);
  }

  const plan: ReconcilePlan = {
    create: [],
    touch: [],
    update: [],
    markGone: [],
    repay: [],
    reopen: [],
    counts: { created: 0, updated: 0, repaid: 0, reopened: 0, unchanged: 0 },
  };

  const presentDebts = new Set<string>();
  const reopened = new Set<string>();

  for (const inc of incoming.values()) {
    const fingerprint = fingerprintOf(inc.draft);
    const finding = existing.get(inc.externalId);
    if (!finding) {
      plan.create.push({ externalId: inc.externalId, draft: inc.draft, fingerprint });
      continue;
    }
    presentDebts.add(finding.debtId);
    const debt = input.debts.get(finding.debtId);
    const conflicts: Conflict[] = [];
    let changed = false;

    if (debt && primary.get(finding.debtId) === finding.externalId) {
      const patch: ReconcilePlan['update'][number]['patch'] = {};
      const changes: ReconcilePlan['update'][number]['changes'] = {};
      for (const field of sourceFields) {
        const next = inc.draft[field];
        const current = debt[field];
        if (next === current) continue;
        if (debt.fieldOrigin[field] === 'manual') {
          conflicts.push({ field, sourceValue: next });
        } else {
          (patch as Record<string, unknown>)[field] = next;
          changes[field] = { from: current, to: next };
        }
      }
      if (Object.keys(patch).length > 0) {
        plan.update.push({ debtId: debt.id, patch, changes });
        changed = true;
      }
    }

    if (finding.goneAt && debt?.status === 'repaid' && !reopened.has(debt.id)) {
      reopened.add(debt.id);
      plan.reopen.push({ debtId: debt.id });
      changed = true;
    }
    plan.touch.push({ externalId: finding.externalId, fingerprint, conflicts });
    if (!changed) plan.counts.unchanged++;
  }

  // findings the source no longer lists
  for (const f of input.findings) {
    if (!incoming.has(f.externalId) && f.goneAt === null) plan.markGone.push(f.externalId);
  }

  // a debt is repaid by its source once all of its findings are gone
  const byDebt = new Map<string, ExistingFinding[]>();
  for (const f of input.findings) byDebt.set(f.debtId, [...(byDebt.get(f.debtId) ?? []), f]);
  for (const [debtId, list] of byDebt) {
    const debt = input.debts.get(debtId);
    if (!debt || presentDebts.has(debtId)) continue;
    const allGone = list.every((f) => !incoming.has(f.externalId));
    const newlyGone = list.some((f) => f.goneAt === null);
    if (allGone && newlyGone && debt.status !== 'repaid') {
      plan.repay.push({ debtId, previousStatus: debt.status });
    }
  }

  plan.counts.created = plan.create.length;
  plan.counts.updated = plan.update.length;
  plan.counts.repaid = plan.repay.length;
  plan.counts.reopened = plan.reopen.length;
  return plan;
}
