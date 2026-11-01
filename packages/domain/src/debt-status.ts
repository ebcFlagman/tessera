import { AppError } from './errors';

export const debtStatuses = ['open', 'planned', 'in_progress', 'repaid', 'accepted'] as const;
export type DebtStatus = (typeof debtStatuses)[number];

export const debtKinds = ['architectural', 'technical'] as const;
export type DebtKind = (typeof debtKinds)[number];

/** Manual transitions. Automatic "repaid" from an import is handled separately (reconcile). */
const transitions: Record<DebtStatus, readonly DebtStatus[]> = {
  open: ['planned', 'in_progress', 'accepted', 'repaid'],
  planned: ['open', 'in_progress', 'accepted', 'repaid'],
  in_progress: ['planned', 'repaid'],
  repaid: ['open'],
  accepted: ['open'],
};

export function canTransition(from: DebtStatus, to: DebtStatus): boolean {
  return transitions[from].includes(to);
}

export function validateTransition(input: {
  from: DebtStatus;
  to: DebtStatus;
  acceptedReason?: string | null;
}): void {
  const { from, to, acceptedReason } = input;
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new AppError('validation_failed', `Statuswechsel ${from} → ${to} ist nicht erlaubt`);
  }
  if (to === 'accepted' && !acceptedReason?.trim()) {
    throw new AppError('validation_failed', 'Für „akzeptiert“ ist eine Begründung erforderlich');
  }
}
