import { CAUSES, demoJudgment } from './cases';
import { evaluate } from './policy';
import type { FlightCase, Thresholds } from './types';
// Controlled labels assess this simulation, not legal correctness or real Jev accuracy.
export function syntheticTruth(c: FlightCase): boolean | null {
  const truth = CAUSES[c.cause].truth;
  if (truth === null) {
    const r = evaluate(c, demoJudgment(c), { approve: 1, deny: 1 });
    return r.confidence === 1 && r.outcome !== 'REVIEW' ? r.outcome === 'APPROVE' : null;
  }
  const oracle = {
    ...demoJudgment(c),
    extraordinaryProbability: truth ? 1 : 0,
    evidenceScore: 3,
    clarityScore: 3,
    evidenceConfidence: 1,
    clarityConfidence: 1,
  };
  const r = evaluate(c, oracle, { approve: 1, deny: 1 });
  return r.outcome === 'REVIEW' ? null : r.outcome === 'APPROVE';
}
export type Costs = { falseApproval: number; falseDenial: number; review: number };
export function summarize(cases: FlightCase[], thresholds: Thresholds, costs: Costs) {
  let approve = 0,
    deny = 0,
    review = 0,
    unlabeled = 0,
    expectedLoss = 0,
    errors = 0,
    labeledAutomated = 0;
  const results = cases.map((c) => {
    const judgment = demoJudgment(c),
      decision = evaluate(c, judgment, thresholds),
      truth = syntheticTruth(c);
    if (decision.outcome === 'APPROVE') approve++;
    else if (decision.outcome === 'DENY') deny++;
    else review++;
    if (truth === null) unlabeled++;
    if (decision.outcome === 'REVIEW') expectedLoss += costs.review;
    else if (truth !== null) {
      labeledAutomated++;
      if ((decision.outcome === 'APPROVE') !== truth) errors++;
      // Expected loss uses fixture probabilities, not a fabricated error measurement.
      if (decision.confidence < 1)
        expectedLoss +=
          (1 - decision.confidence) *
          (decision.outcome === 'APPROVE' ? costs.falseApproval : costs.falseDenial);
    }
    return { case: c, judgment, decision, truth };
  });
  return {
    approve,
    deny,
    review,
    unlabeled,
    expectedLoss,
    errors,
    labeledAutomated,
    automation: (approve + deny) / cases.length,
    results,
  };
}
export function frontier(cases: FlightCase[], costs: Costs) {
  return [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.94, 0.96, 0.98, 0.99, 1].map((approve) => {
    const thresholds = { approve, deny: Math.min(1, approve + 0.04) };
    return { thresholds, ...summarize(cases, thresholds, costs) };
  });
}
