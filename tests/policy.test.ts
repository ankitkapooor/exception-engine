import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK, demoJudgment, INITIAL_CASE, makeCases } from '../src/lib/cases';
import {
  compensationAmount,
  compensationBand,
  cancellationExemption,
  evaluate,
  assistance,
} from '../src/lib/policy';
import { DEFAULT_THRESHOLDS, caseSchema, type FlightCase, type Judgment } from '../src/lib/types';
import { frontier, summarize, syntheticTruth } from '../src/lib/benchmark';
const base: FlightCase = {
  ...INITIAL_CASE,
  event: 'delay',
  arrivalDelay: 240,
  cause: 'maintenance',
  evidence: 'complete',
};
const judgment: Judgment = {
  ...demoJudgment(base),
  extraordinaryProbability: 0,
  evidenceConfidence: 1,
  clarityConfidence: 1,
};
const run = (patch: Partial<FlightCase> = {}, j: Partial<Judgment> = {}) =>
  evaluate({ ...base, ...patch }, { ...judgment, ...j }, DEFAULT_THRESHOLDS);

test('journey coverage covers EU departures regardless of carrier', () => {
  assert.equal(run({ originEU: true, destinationEU: false, euCarrier: false }).outcome, 'APPROVE');
  assert.equal(run({ originEU: false, destinationEU: true, euCarrier: true }).outcome, 'APPROVE');
  assert.equal(run({ originEU: false, destinationEU: true, euCarrier: false }).outcome, 'DENY');
  assert.equal(run({ originEU: false, destinationEU: false, euCarrier: true }).outcome, 'DENY');
});
test('delay threshold is inclusive at 180 minutes', () => {
  assert.equal(run({ arrivalDelay: 179 }).outcome, 'DENY');
  assert.equal(run({ arrivalDelay: 180 }).outcome, 'APPROVE');
  assert.equal(run({ arrivalDelay: 181 }).outcome, 'APPROVE');
});
test('cancellation notice flips at exactly 14 days', () => {
  assert.equal(
    run({ event: 'cancellation', noticeDays: 13.9, rerouting: false }).outcome,
    'APPROVE',
  );
  assert.equal(run({ event: 'cancellation', noticeDays: 14, rerouting: false }).outcome, 'DENY');
});
test('7–14 day rerouting: departure inclusive, arrival strict', () => {
  const c = {
    ...base,
    event: 'cancellation' as const,
    noticeDays: 7,
    rerouting: true,
    rerouteDepartureEarly: 120,
    rerouteArrivalDelay: 239,
  };
  assert.ok(cancellationExemption(c));
  assert.equal(cancellationExemption({ ...c, rerouteArrivalDelay: 240 }), null);
  assert.equal(cancellationExemption({ ...c, rerouteDepartureEarly: 121 }), null);
  assert.equal(cancellationExemption({ ...c, noticeDays: 6.9 }), null);
});
test('under 7 day rerouting: departure inclusive, arrival strict', () => {
  const c = {
    ...base,
    event: 'cancellation' as const,
    noticeDays: 6,
    rerouting: true,
    rerouteDepartureEarly: 60,
    rerouteArrivalDelay: 119,
  };
  assert.ok(cancellationExemption(c));
  assert.equal(cancellationExemption({ ...c, rerouteArrivalDelay: 120 }), null);
  assert.equal(cancellationExemption({ ...c, rerouteDepartureEarly: 61 }), null);
});
test('distance brackets and intra-EU long-haul exception', () => {
  for (const [distanceKm, expected] of [
    [1499, 250],
    [1500, 250],
    [1501, 400],
    [3500, 400],
    [3501, 600],
  ] as const)
    assert.equal(compensationBand({ ...base, distanceKm, destinationEU: false }), expected);
  assert.equal(
    compensationBand({ ...base, distanceKm: 5200, originEU: true, destinationEU: true }),
    400,
  );
});
test('long-haul delay compensation is 300 at 3–4 h, 600 at 4 h', () => {
  assert.equal(run({ destinationEU: false, distanceKm: 5200, arrivalDelay: 180 }).amount, 300);
  assert.equal(run({ destinationEU: false, distanceKm: 5200, arrivalDelay: 239 }).amount, 300);
  assert.equal(run({ destinationEU: false, distanceKm: 5200, arrivalDelay: 240 }).amount, 600);
});
test('rerouting reduction cutoffs are inclusive across all brackets', () => {
  for (const [distanceKm, limit, baseAmount] of [
    [1500, 120, 250],
    [3500, 180, 400],
    [3501, 240, 600],
  ] as const) {
    const c = {
      ...base,
      event: 'denied_boarding' as const,
      destinationEU: false,
      distanceKm,
      rerouting: true,
      rerouteArrivalDelay: limit,
    };
    assert.equal(compensationAmount(c), baseAmount / 2);
    assert.equal(compensationAmount({ ...c, rerouteArrivalDelay: limit + 1 }), baseAmount);
    assert.equal(compensationAmount({ ...c, rerouting: false }), baseAmount);
  }
});
test('extraordinary circumstances cannot exempt involuntary overbooking', () => {
  assert.equal(
    run(
      { event: 'denied_boarding', boardingReason: 'overbooking' },
      { extraordinaryProbability: 1 },
    ).outcome,
    'APPROVE',
  );
  for (const boardingReason of ['safety', 'voluntary', 'unknown'] as const)
    assert.equal(run({ event: 'denied_boarding', boardingReason }).outcome, 'REVIEW');
});
test('scope edge cases are escalated', () => {
  assert.equal(run({ specialCase: true }).outcome, 'REVIEW');
  assert.equal(run({ specialCase: true, originEU: false, destinationEU: false }).outcome, 'REVIEW');
});
test('separate gates, exact threshold equality, insufficient evidence', () => {
  assert.equal(run({}, { extraordinaryProbability: 0.1 }).outcome, 'APPROVE');
  assert.equal(run({}, { extraordinaryProbability: 0.101 }).outcome, 'REVIEW');
  assert.equal(run({}, { extraordinaryProbability: 0.98 }).outcome, 'DENY');
  assert.equal(run({}, { extraordinaryProbability: 0.979 }).outcome, 'REVIEW');
  assert.equal(run({}, { evidenceScore: 1.99 }).outcome, 'REVIEW');
  assert.equal(run({}, { clarityScore: 1.99 }).outcome, 'REVIEW');
  assert.equal(run({}, { evidenceConfidence: 0.89 }).outcome, 'REVIEW');
  assert.equal(run({}, { clarityConfidence: 0.89 }).outcome, 'REVIEW');
});
test('compensation denial keeps assistance separate; departure care thresholds', () => {
  assert.match(assistance({ ...base, event: 'cancellation', noticeDays: 14 }), /Care/);
  for (const [distanceKm, destinationEU, threshold] of [
    [1500, true, 120],
    [1501, true, 180],
    [3501, false, 240],
  ] as const) {
    assert.match(
      assistance({ ...base, distanceKm, destinationEU, departureDelay: threshold }),
      /threshold met/,
    );
    assert.match(
      assistance({ ...base, distanceKm, destinationEU, departureDelay: threshold - 1 }),
      /not met/,
    );
  }
});
test('600 valid reproducible synthetic records and a hard 700 cap', () => {
  assert.equal(BENCHMARK.length, 600);
  for (const c of BENCHMARK) assert.ok(caseSchema.safeParse(c).success);
  assert.deepEqual(makeCases(2), BENCHMARK.slice(0, 2));
  assert.throws(() => makeCases(701), RangeError);
  assert.throws(() => makeCases(1.5), RangeError);
  assert.throws(() => makeCases(0), RangeError);
});
test('benchmark preserves ambiguity; aggregate accounting and thresholds are monotonic', () => {
  assert.equal(syntheticTruth(INITIAL_CASE), null);
  const costs = { falseApproval: 400, falseDenial: 1200, review: 25 };
  const normal = summarize(BENCHMARK, DEFAULT_THRESHOLDS, costs);
  assert.equal(normal.approve + normal.deny + normal.review, 600);
  assert.ok(normal.unlabeled > 0);
  assert.equal(normal.errors, 0);
  const strict = summarize(BENCHMARK, { approve: 1, deny: 1 }, costs);
  assert.ok(strict.automation <= normal.automation);
  assert.ok(Number.isFinite(normal.expectedLoss));
  const policies = frontier(BENCHMARK, costs);
  assert.equal(policies.length, 11);
  assert.ok(policies.every((p) => p.thresholds.deny >= p.thresholds.approve));
  const freeReview = summarize(BENCHMARK, DEFAULT_THRESHOLDS, { ...costs, review: 5 });
  assert.ok(freeReview.expectedLoss < normal.expectedLoss);
});
test('receipts expose linked provenance on every rule', () => {
  const decision = run();
  assert.ok(decision.rules.every((r) => r.source.startsWith('https://') && r.id && r.detail));
  assert.ok(decision.policyVersion && decision.counterfactual && decision.assistance);
});
