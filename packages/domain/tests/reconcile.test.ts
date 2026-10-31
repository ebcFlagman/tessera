import { describe, expect, it } from 'vitest';
import {
  fingerprintOf,
  reconcile,
  type DebtDraft,
  type ExistingDebt,
  type ExistingFinding,
} from '../src';

const draft = (over: Partial<DebtDraft> = {}): DebtDraft => ({
  title: 'Methode zu lang',
  description: 'zu komplex',
  kind: 'technical',
  effortEstimate: 0.5,
  url: 'https://src.example/1',
  ...over,
});

const debt = (over: Partial<ExistingDebt> = {}): ExistingDebt => ({
  id: 'd1',
  status: 'open',
  fieldOrigin: { title: 'source', description: 'source', kind: 'source', effortEstimate: 'source' },
  title: 'Methode zu lang',
  description: 'zu komplex',
  kind: 'technical',
  effortEstimate: 0.5,
  ...over,
});

const finding = (over: Partial<ExistingFinding> = {}): ExistingFinding => ({
  externalId: 'A',
  debtId: 'd1',
  goneAt: null,
  firstSeenAt: new Date('2026-01-01'),
  fingerprint: fingerprintOf(draft()),
  ...over,
});

const run = (o: {
  findings?: ExistingFinding[];
  debts?: ExistingDebt[];
  incoming?: { externalId: string; draft: DebtDraft }[];
}) =>
  reconcile({
    findings: o.findings ?? [],
    debts: new Map((o.debts ?? []).map((d) => [d.id, d])),
    incoming: o.incoming ?? [],
  });

describe('reconcile', () => {
  it('creates debts for new findings', () => {
    const plan = run({ incoming: [{ externalId: 'A', draft: draft() }] });
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]?.externalId).toBe('A');
    expect(plan.counts).toMatchObject({ created: 1, updated: 0, repaid: 0 });
  });

  it('is idempotent: the same listing against the stored state changes nothing', () => {
    const plan = run({
      findings: [finding()],
      debts: [debt()],
      incoming: [{ externalId: 'A', draft: draft() }],
    });
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.markGone).toEqual([]);
    expect(plan.repay).toEqual([]);
    expect(plan.counts).toEqual({ created: 0, updated: 0, repaid: 0, reopened: 0, unchanged: 1 });
  });

  it('updates source-driven fields and records old and new values', () => {
    const plan = run({
      findings: [finding()],
      debts: [debt()],
      incoming: [{ externalId: 'A', draft: draft({ title: 'Neuer Titel', effortEstimate: 1 }) }],
    });
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0]?.patch).toEqual({ title: 'Neuer Titel', effortEstimate: 1 });
    expect(plan.update[0]?.changes.title).toEqual({ from: 'Methode zu lang', to: 'Neuer Titel' });
    expect(plan.counts.updated).toBe(1);
  });

  it('never overwrites manually maintained fields and reports the conflict instead', () => {
    const plan = run({
      findings: [finding()],
      debts: [
        debt({ title: 'Mein Titel', fieldOrigin: { title: 'manual', description: 'source' } }),
      ],
      incoming: [{ externalId: 'A', draft: draft({ title: 'Quelle sagt etwas anderes' }) }],
    });
    expect(plan.update).toEqual([]);
    expect(plan.touch[0]?.conflicts).toEqual([
      { field: 'title', sourceValue: 'Quelle sagt etwas anderes' },
    ]);
  });

  it('marks findings gone and repays the debt, even over a manual "accepted" status', () => {
    for (const status of ['open', 'planned', 'in_progress', 'accepted'] as const) {
      const plan = run({ findings: [finding()], debts: [debt({ status })], incoming: [] });
      expect(plan.markGone).toEqual(['A']);
      expect(plan.repay).toEqual([{ debtId: 'd1', previousStatus: status }]);
    }
  });

  it('does not repay again once the debt is repaid and the finding is already gone', () => {
    const plan = run({
      findings: [finding({ goneAt: new Date('2026-02-01') })],
      debts: [debt({ status: 'repaid' })],
      incoming: [],
    });
    expect(plan.markGone).toEqual([]);
    expect(plan.repay).toEqual([]);
  });

  it('reopens a repaid debt when its finding reappears', () => {
    const plan = run({
      findings: [finding({ goneAt: new Date('2026-02-01') })],
      debts: [debt({ status: 'repaid' })],
      incoming: [{ externalId: 'A', draft: draft() }],
    });
    expect(plan.reopen).toEqual([{ debtId: 'd1' }]);
    expect(plan.counts.reopened).toBe(1);
  });

  it('repays a debt with several findings only when all of them are gone', () => {
    const findings = [
      finding({ externalId: 'A' }),
      finding({ externalId: 'B', firstSeenAt: new Date('2026-01-02') }),
    ];
    const onlyA = run({
      findings,
      debts: [debt()],
      incoming: [{ externalId: 'A', draft: draft() }],
    });
    expect(onlyA.markGone).toEqual(['B']);
    expect(onlyA.repay).toEqual([]);
    const none = run({ findings, debts: [debt()], incoming: [] });
    expect(none.repay).toEqual([{ debtId: 'd1', previousStatus: 'open' }]);
  });

  it('only the oldest finding of a debt drives its source fields', () => {
    const findings = [
      finding({ externalId: 'A' }),
      finding({ externalId: 'B', firstSeenAt: new Date('2026-01-02') }),
    ];
    const plan = run({
      findings,
      debts: [debt()],
      incoming: [
        { externalId: 'A', draft: draft() },
        { externalId: 'B', draft: draft({ title: 'andere Quelle' }) },
      ],
    });
    expect(plan.update).toEqual([]);
  });

  it('treats duplicate externalIds in one listing as one finding', () => {
    const plan = run({
      incoming: [
        { externalId: 'A', draft: draft() },
        { externalId: 'A', draft: draft() },
      ],
    });
    expect(plan.create).toHaveLength(1);
  });
});
