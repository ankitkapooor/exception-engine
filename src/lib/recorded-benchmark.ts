import { z } from 'zod';
import { BENCHMARK } from './cases';
import { caseSchema, type FlightCase } from './types';
const probability = z.number().min(0).max(1);
export const judgmentSchema = z.object({
  extraordinaryProbability: probability,
  evidenceScore: z.number().min(0).max(3),
  clarityScore: z.number().min(0).max(3),
  evidenceConfidence: probability,
  clarityConfidence: probability,
  mode: z.literal('live'),
  model: z.string().min(1),
  questionVersion: z.literal('facts-v1'),
  timestamp: z.iso.datetime(),
  distributions: z
    .object({ evidence: z.array(probability).length(4), clarity: z.array(probability).length(4) })
    .optional(),
});
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  seed: z.literal(2612004),
  caseCount: z.literal(600),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  models: z.array(z.string().min(1)).min(1),
  records: z
    .array(
      z.object({
        case: caseSchema,
        judgment: judgmentSchema,
        durationMs: z.number().nonnegative().optional(),
      }),
    )
    .length(600),
});
export type RecordedBenchmark = z.infer<typeof snapshotSchema>;
export const caseSignature = (c: FlightCase) =>
  JSON.stringify(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
export function parseRecordedBenchmark(data: unknown): RecordedBenchmark {
  const snapshot = snapshotSchema.parse(data);
  const expected = new Map(BENCHMARK.map((c) => [c.id, caseSignature(c)]));
  const seen = new Set<string>();
  for (const record of snapshot.records) {
    if (
      seen.has(record.case.id) ||
      expected.get(record.case.id) !== caseSignature(record.case) ||
      !snapshot.models.includes(record.judgment.model)
    )
      throw new Error('Recorded benchmark does not match the fixed 600-case dataset.');
    seen.add(record.case.id);
  }
  return snapshot;
}
