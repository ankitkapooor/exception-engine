import type { Decision, FlightCase, Judgment, Rule, Thresholds } from './types';
export const POLICY_VERSION = 'EU261-lab/1.0.0';
export const REGULATION = 'https://eur-lex.europa.eu/eli/reg/2004/261/oj/eng';
export const GUIDANCE = 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/';
const percentage = (n: number) => `${Number((n * 100).toFixed(1))}%`;
export const covered = (c: FlightCase) => c.originEU || (c.destinationEU && c.euCarrier);
export function compensationBand(c: FlightCase) {
  if (c.distanceKm <= 1500) return 250;
  if ((c.originEU && c.destinationEU) || c.distanceKm <= 3500) return 400;
  return 600;
}
export function cancellationExemption(c: FlightCase): string | null {
  if (c.noticeDays >= 14) return 'Notification was at least 14 days before departure.';
  if (!c.rerouting) return null;
  if (c.noticeDays >= 7 && c.rerouteDepartureEarly <= 120 && c.rerouteArrivalDelay < 240)
    return '7–14 days notice; replacement departs ≤2 hours early and arrives <4 hours late.';
  if (c.noticeDays < 7 && c.rerouteDepartureEarly <= 60 && c.rerouteArrivalDelay < 120)
    return '<7 days notice; replacement departs ≤1 hour early and arrives <2 hours late.';
  return null;
}
export function compensationAmount(c: FlightCase) {
  const base = compensationBand(c);
  const reductionLimit = base === 250 ? 120 : base === 400 ? 180 : 240;
  if (c.event === 'delay') {
    // The long-haul 3–4 h reduction is distinct from the rerouting reduction.
    if (base === 600 && c.arrivalDelay < 240) return 300;
    return base;
  }
  return c.rerouting && c.rerouteArrivalDelay <= reductionLimit ? base / 2 : base;
}
export function assistance(c: FlightCase): string {
  if (c.specialCase) return 'Care and assistance need individual review for this scope edge case.';
  if (!covered(c)) return 'Outside this simulation’s EU261 scope; other rights may apply.';
  if (c.event === 'denied_boarding' && c.boardingReason !== 'overbooking')
    return 'Boarding grounds need separate assessment; care is not determined here.';
  if (c.event === 'cancellation' || c.event === 'denied_boarding')
    return 'Care while awaiting earliest rerouting; reimbursement or rerouting assessed separately. Compensation denial does not remove care.';
  const wait =
    c.distanceKm <= 1500
      ? 120
      : (c.originEU && c.destinationEU) || c.distanceKm <= 3500
        ? 180
        : 240;
  return c.departureDelay >= wait
    ? 'Departure-wait threshold met: meals and communications; accommodation if an overnight stay is necessary. At ≥5 hours, a reimbursement option may apply.'
    : `Care waiting-time threshold is ${wait} minutes of departure delay; it is not met in this case.`;
}
export function evaluate(c: FlightCase, j: Judgment, t: Thresholds): Decision {
  const rules: Rule[] = [];
  const add = (
    id: string,
    label: string,
    detail: string,
    state: Rule['state'],
    source = REGULATION,
  ) => rules.push({ id, label, detail, state, source });
  const finish = (
    outcome: Decision['outcome'],
    reason: string,
    confidence: number,
    eligible: boolean | null,
    counterfactual: string,
    amount = 0,
  ): Decision => ({
    outcome,
    reason,
    amount,
    baseAmount: compensationBand(c),
    confidence,
    threshold: outcome === 'DENY' || eligible === false ? t.deny : t.approve,
    rules,
    assistance: assistance(c),
    counterfactual,
    policyVersion: POLICY_VERSION,
    eligible,
  });
  if (c.specialCase) {
    add(
      'SCOPE',
      'Scope check',
      'Connecting itineraries, overseas territories, prior non-EU benefits, or disputed facts require individual review.',
      'review',
      'https://github.com/ankitkapooor/exception-engine/blob/main/docs/methodology.md',
    );
    return finish(
      'REVIEW',
      'This case includes a scope edge case outside the simplified model.',
      0,
      null,
      'Resolve the scope issue before applying these rules.',
    );
  }
  const isCovered = covered(c);
  add(
    'ART. 3',
    'Journey coverage',
    c.originEU
      ? 'Departure from an EU airport, regardless of carrier.'
      : c.destinationEU && c.euCarrier
        ? 'Arrival in the EU on an EU carrier.'
        : 'Non-EU departure without a qualifying EU-carrier arrival.',
    isCovered ? 'pass' : 'fail',
  );
  if (!isCovered)
    return finish(
      'DENY',
      'Journey falls outside the modeled EU261 coverage.',
      1,
      false,
      'An EU departure, or an EU arrival on an EU carrier, changes coverage.',
    );
  if (c.event === 'denied_boarding') {
    if (c.boardingReason !== 'overbooking') {
      add(
        'ART. 4',
        'Boarding grounds',
        'Only involuntary overbooking with valid documents and timely check-in is modeled.',
        'review',
      );
      return finish(
        'REVIEW',
        'Boarding grounds need individual assessment.',
        0,
        null,
        'Establish involuntary overbooking and valid travel documents.',
      );
    }
    add(
      'ART. 4',
      'Involuntary denied boarding',
      'Overbooking; passenger checked in on time with valid documents. Extraordinary circumstances are not used as an exemption here.',
      'pass',
    );
    add(
      'ART. 7',
      'Compensation bracket',
      `Base €${compensationBand(c)}; rerouting reduction, if applicable, gives €${compensationAmount(c)}.`,
      'pass',
    );
    return finish(
      'APPROVE',
      'Involuntary overbooking supports compensation in this model.',
      1,
      true,
      'A disputed or voluntary boarding refusal moves the case to review.',
      compensationAmount(c),
    );
  }
  if (c.event === 'delay') {
    const meets = c.arrivalDelay >= 180;
    add(
      '3-HOUR RULE',
      'Arrival delay',
      `${c.arrivalDelay} minutes ${meets ? 'meets' : 'is below'} the 180-minute threshold.`,
      meets ? 'pass' : 'fail',
      GUIDANCE,
    );
    if (!meets)
      return finish(
        'DENY',
        'Arrival delay is below three hours.',
        1,
        false,
        `Increase arrival delay from ${c.arrivalDelay} to 180 minutes to cross the timing boundary.`,
      );
  } else {
    const exemption = cancellationExemption(c);
    add(
      'ART. 5(1)(c)',
      'Notice & rerouting',
      exemption ?? `${c.noticeDays} days notice; no notice/rerouting exemption applies.`,
      exemption ? 'fail' : 'pass',
    );
    if (exemption)
      return finish(
        'DENY',
        exemption,
        1,
        false,
        c.noticeDays >= 14
          ? 'Notification below 14 days reopens the notice and rerouting assessment.'
          : 'Crossing the departure or arrival rerouting limit reopens compensation eligibility.',
      );
  }
  const p = j.extraordinaryProbability;
  const factualConfidence = Math.min(
    p >= 0.5 ? p : 1 - p,
    j.evidenceConfidence,
    j.clarityConfidence,
  );
  const threshold = p >= 0.5 ? t.deny : t.approve;
  const adequate = j.evidenceScore >= 2 && j.clarityScore >= 2;
  add(
    'ART. 5(3)',
    'Extraordinary circumstances',
    `${percentage(p)} probability of an external, unavoidable cause with reasonable measures taken. ${j.mode === 'demo' ? 'Synthetic fixture, not a Jev inference.' : 'Bounded Jev factual assessment.'}`,
    adequate && factualConfidence >= threshold ? 'pass' : 'review',
  );
  add(
    'GATE v1',
    'Automation confidence',
    `${percentage(factualConfidence)} conservative judgment strength; ${percentage(threshold)} ${p >= 0.5 ? 'denial' : 'approval'} threshold. Evidence ${j.evidenceScore.toFixed(1)}/3, clarity ${j.clarityScore.toFixed(1)}/3.`,
    adequate && factualConfidence >= threshold ? 'pass' : 'review',
    'https://github.com/ankitkapooor/exception-engine/blob/main/docs/methodology.md',
  );
  if (!adequate)
    return finish(
      'REVIEW',
      'Evidence is incomplete or contradictory. A human should resolve the facts.',
      factualConfidence,
      null,
      'Provide consistent evidence and a supported account of the cause.',
    );
  if (factualConfidence < threshold)
    return finish(
      'REVIEW',
      'The factual judgment does not meet the configured automation threshold.',
      factualConfidence,
      null,
      `Judgment strength must reach ${percentage(threshold)}, or the relevant risk threshold must be lowered.`,
    );
  if (p >= 0.5)
    return finish(
      'DENY',
      'Evidence supports extraordinary circumstances and reasonable measures in this simulation.',
      factualConfidence,
      false,
      'Evidence that the cause was within the carrier’s normal control can change the result.',
    );
  add(
    'ART. 7',
    'Compensation bracket',
    `Base €${compensationBand(c)}; applicable timing/reduction gives €${compensationAmount(c)}.`,
    'pass',
  );
  return finish(
    'APPROVE',
    'Timing and coverage qualify; evidence supports an ordinary operational cause.',
    factualConfidence,
    true,
    c.event === 'delay'
      ? 'An arrival delay below 180 minutes changes the timing result.'
      : 'At least 14 days notice removes compensation under the modeled notice rule.',
    compensationAmount(c),
  );
}
