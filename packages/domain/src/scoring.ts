import { AppError } from './errors';

/**
 * `up`: a higher score means a more urgent debt (impact, risk, running cost).
 * `down`: a higher score lowers the priority (effort to repay).
 */
export type Direction = 'up' | 'down';

export interface Criterion {
  key: string;
  name: string;
  weight: number;
  direction: Direction;
}

export type Scores = Record<string, number>;

export interface BreakdownItem {
  key: string;
  name: string;
  score: number;
  weight: number;
  /** 0..1, after applying the direction */
  normalized: number;
  /** points of the 0–100 priority this criterion contributes */
  contribution: number;
}

export interface PriorityResult {
  priority: number;
  breakdown: BreakdownItem[];
}

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export const defaultCriteria: Criterion[] = [
  { key: 'impact', name: 'Auswirkung', weight: 3, direction: 'up' },
  { key: 'risk', name: 'Risiko', weight: 3, direction: 'up' },
  { key: 'interest', name: 'Folgekosten', weight: 2, direction: 'up' },
  { key: 'effort', name: 'Aufwand', weight: 1, direction: 'down' },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function validateCriteria(criteria: Criterion[]): void {
  if (criteria.length === 0) {
    throw new AppError(
      'validation_failed',
      'Das Bewertungsmodell braucht mindestens ein Kriterium',
    );
  }
  const seen = new Set<string>();
  for (const c of criteria) {
    if (!c.key.trim() || !c.name.trim()) {
      throw new AppError('validation_failed', 'Jedes Kriterium braucht Schlüssel und Namen');
    }
    if (seen.has(c.key)) {
      throw new AppError('validation_failed', `Kriterium „${c.key}“ ist doppelt vorhanden`);
    }
    seen.add(c.key);
    if (!Number.isFinite(c.weight) || c.weight < 0) {
      throw new AppError('validation_failed', `Gewicht von „${c.name}“ muss eine Zahl ≥ 0 sein`);
    }
  }
  if (!criteria.some((c) => c.weight > 0)) {
    throw new AppError('validation_failed', 'Mindestens ein Kriterium braucht ein Gewicht > 0');
  }
}

export function validateScores(criteria: Criterion[], scores: Scores): void {
  const known = new Set(criteria.map((c) => c.key));
  for (const key of Object.keys(scores)) {
    if (!known.has(key)) {
      throw new AppError('validation_failed', `Unbekanntes Kriterium „${key}“`);
    }
  }
  for (const c of criteria) {
    const v = scores[c.key];
    if (v === undefined) {
      throw new AppError('validation_failed', `Für „${c.name}“ fehlt eine Bewertung`);
    }
    if (!Number.isInteger(v) || v < MIN_SCORE || v > MAX_SCORE) {
      throw new AppError(
        'validation_failed',
        `„${c.name}“ muss eine ganze Zahl von ${MIN_SCORE} bis ${MAX_SCORE} sein`,
      );
    }
  }
}

/** Weighted average of the normalised scores, scaled to 0–100 (one decimal). */
export function computePriority(criteria: Criterion[], scores: Scores): PriorityResult {
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const breakdown = criteria.map<BreakdownItem>((c) => {
    const score = scores[c.key] ?? MIN_SCORE;
    const raw = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
    const normalized = c.direction === 'up' ? raw : 1 - raw;
    const contribution = totalWeight === 0 ? 0 : (100 * c.weight * normalized) / totalWeight;
    return {
      key: c.key,
      name: c.name,
      score,
      weight: c.weight,
      normalized,
      contribution: round1(contribution),
    };
  });
  const priority =
    totalWeight === 0
      ? 0
      : round1(breakdown.reduce((s, b) => s + (100 * b.weight * b.normalized) / totalWeight, 0));
  return { priority, breakdown };
}

/**
 * Recomputes a stored assessment under a (new) model. Returns null when the model has a
 * criterion the assessment never scored: the debt then needs a new assessment.
 */
export function recomputeFromScores(criteria: Criterion[], scores: Scores): number | null {
  for (const c of criteria) {
    const v = scores[c.key];
    if (v === undefined || !Number.isInteger(v) || v < MIN_SCORE || v > MAX_SCORE) return null;
  }
  return computePriority(criteria, scores).priority;
}

export function effectivePriority(p: {
  calculated: number | null;
  override: number | null;
}): number | null {
  return p.override ?? p.calculated;
}
