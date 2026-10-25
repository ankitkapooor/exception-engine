import { z } from 'zod';

export const caseSchema = z.object({
  id: z.string().max(40),
  origin: z.string().min(1).max(80),
  destination: z.string().min(1).max(80),
  originEU: z.boolean(),
  destinationEU: z.boolean(),
  euCarrier: z.boolean(),
  distanceKm: z.number().int().min(1).max(15000),
  event: z.enum(['delay', 'cancellation', 'denied_boarding']),
  arrivalDelay: z.number().int().min(0).max(1440),
  departureDelay: z.number().int().min(0).max(1440),
  noticeDays: z.number().min(0).max(30),
  rerouting: z.boolean(),
  rerouteDepartureEarly: z.number().int().min(0).max(720),
  rerouteArrivalDelay: z.number().int().min(0).max(1440),
  cause: z.enum(['maintenance', 'weather', 'mixed', 'crew', 'unknown']),
  evidence: z.enum(['complete', 'partial', 'conflicting']),
  narrative: z.string().min(1).max(3000),
  boardingReason: z.enum(['overbooking', 'voluntary', 'safety', 'unknown']),
  specialCase: z.boolean(),
});
export type FlightCase = z.infer<typeof caseSchema>;
export const thresholdSchema = z.object({
  approve: z.number().min(0.5).max(1),
  deny: z.number().min(0.5).max(1),
});
export type Thresholds = z.infer<typeof thresholdSchema>;
export type Outcome = 'APPROVE' | 'DENY' | 'REVIEW';
export type Judgment = {
  extraordinaryProbability: number;
  evidenceScore: number;
  clarityScore: number;
  evidenceConfidence: number;
  clarityConfidence: number;
  mode: 'demo' | 'live';
  model: string;
  questionVersion: string;
  timestamp: string;
  distributions?: { evidence: number[]; clarity: number[] };
};
export type Rule = {
  id: string;
  label: string;
  detail: string;
  state: 'pass' | 'fail' | 'review' | 'skip';
  source: string;
};
export type Decision = {
  outcome: Outcome;
  reason: string;
  amount: number;
  baseAmount: number;
  confidence: number;
  threshold: number;
  rules: Rule[];
  assistance: string;
  counterfactual: string;
  policyVersion: string;
  eligible: boolean | null;
};
export const DEFAULT_THRESHOLDS: Thresholds = { approve: 0.9, deny: 0.98 };
export const MAX_CASES = 700;
