import { MAX_CASES, type FlightCase, type Judgment } from './types';
export const CAUSES = {
  maintenance: {
    label: 'Routine maintenance',
    text: 'The maintenance log identifies a worn hydraulic component during routine inspection. A replacement part was available at the base. The airline attributed the disruption to this ordinary technical fault.',
    p: 0.025,
    truth: false,
  },
  weather: {
    label: 'Airport closure',
    text: 'An official airport notice confirms all runways closed during the flight window due to a severe storm. The flight was directly affected. Records show the airline explored alternative airports and all reasonable rerouting options without success.',
    p: 0.995,
    truth: true,
  },
  mixed: {
    label: 'Conflicting accounts',
    text: 'The airline cites severe weather, but the passenger has a message reporting a technical fault. Other flights departed. No airport closure notice or maintenance log is available; the primary cause and reasonable measures remain disputed.',
    p: 0.37,
    truth: null,
  },
  crew: {
    label: 'Crew scheduling',
    text: 'The airline operations report confirms that a predictable crew scheduling error left the flight without a legal crew. No external incident was involved. The airline failed to activate an available reserve crew.',
    p: 0.04,
    truth: false,
  },
  unknown: {
    label: 'Cause not documented',
    text: 'The passenger reports a disruption. The airline states operational reasons without supporting documents. The actual cause and mitigation measures are unknown.',
    p: 0.5,
    truth: null,
  },
} as const;
export const INITIAL_CASE: FlightCase = {
  id: 'EE-0001',
  origin: 'Barcelona',
  destination: 'Berlin',
  originEU: true,
  destinationEU: true,
  euCarrier: true,
  distanceKm: 1501,
  event: 'cancellation',
  arrivalDelay: 247,
  departureDelay: 240,
  noticeDays: 8,
  rerouting: true,
  rerouteDepartureEarly: 90,
  rerouteArrivalDelay: 240,
  cause: 'mixed',
  evidence: 'conflicting',
  narrative: CAUSES.mixed.text,
  boardingReason: 'overbooking',
  specialCase: false,
};
export function demoJudgment(c: FlightCase): Judgment {
  const score = c.evidence === 'complete' ? 3 : c.evidence === 'partial' ? 1.6 : 0.8;
  const clarity = c.cause === 'unknown' ? 0.5 : c.cause === 'mixed' ? 1 : score;
  return {
    extraordinaryProbability: CAUSES[c.cause].p,
    evidenceScore: score,
    clarityScore: clarity,
    evidenceConfidence: c.evidence === 'complete' ? 0.995 : 0.76,
    clarityConfidence: c.evidence === 'complete' ? 0.995 : 0.72,
    mode: 'demo',
    model: 'synthetic-fixtures-v1',
    questionVersion: 'facts-v1',
    timestamp: '2026-10-25T00:00:00.000Z',
  };
}
export function makeCases(count = 600): FlightCase[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_CASES)
    throw new RangeError(`Choose 1–${MAX_CASES} cases.`);
  let seed = 2612004;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = <T>(a: readonly T[]): T => a[Math.floor(random() * a.length)];
  return Array.from({ length: count }, (_, i) => {
    const cause = pick(Object.keys(CAUSES) as (keyof typeof CAUSES)[]);
    const originEU = random() > 0.25,
      destinationEU = random() > 0.25;
    return {
      ...INITIAL_CASE,
      id: `EE-${String(i + 1).padStart(4, '0')}`,
      origin: originEU ? 'Barcelona' : 'New York',
      destination: destinationEU ? 'Berlin' : 'Dubai',
      originEU,
      destinationEU,
      euCarrier: random() > 0.3,
      distanceKm: pick([1499, 1500, 1501, 3499, 3500, 3501, 5200]),
      event: pick(['delay', 'cancellation', 'denied_boarding'] as const),
      arrivalDelay: pick([119, 179, 180, 181, 239, 240, 241, 360]),
      departureDelay: pick([119, 120, 179, 180, 239, 240, 300]),
      noticeDays: pick([0, 6, 6.9, 7, 8, 13, 13.9, 14, 15]),
      rerouting: random() > 0.25,
      rerouteDepartureEarly: pick([59, 60, 61, 90, 119, 120, 121]),
      rerouteArrivalDelay: pick([119, 120, 121, 179, 180, 181, 239, 240, 241]),
      evidence: pick(['complete', 'complete', 'complete', 'partial', 'conflicting'] as const),
      cause,
      narrative: CAUSES[cause].text,
      boardingReason: pick(['overbooking', 'overbooking', 'safety', 'unknown'] as const),
    };
  });
}
export const BENCHMARK = makeCases();
export const PRESETS: { name: string; note: string; case: FlightCase }[] = [
  { name: 'The disputed cancellation', note: 'One flight. Two accounts.', case: INITIAL_CASE },
  {
    name: 'An ordinary technical fault',
    note: 'A clear case for compensation.',
    case: {
      ...INITIAL_CASE,
      id: 'EE-DEMO-2',
      cause: 'maintenance',
      evidence: 'complete',
      narrative: CAUSES.maintenance.text,
    },
  },
  {
    name: 'The 14-day boundary',
    note: 'One day changes the policy.',
    case: {
      ...INITIAL_CASE,
      id: 'EE-DEMO-3',
      noticeDays: 13,
      rerouting: false,
      cause: 'crew',
      evidence: 'complete',
      narrative: CAUSES.crew.text,
    },
  },
  {
    name: '179 minutes late',
    note: 'Close to the three-hour line.',
    case: {
      ...INITIAL_CASE,
      id: 'EE-DEMO-4',
      event: 'delay',
      arrivalDelay: 179,
      cause: 'maintenance',
      evidence: 'complete',
      narrative: CAUSES.maintenance.text,
    },
  },
];
