/** Resumable 600-case run. The public endpoint retains its 5/minute limit. */
import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { BENCHMARK } from '../src/lib/cases';
import { DEFAULT_THRESHOLDS, type Judgment } from '../src/lib/types';
import { evaluate } from '../src/lib/policy';
import { summarize } from '../src/lib/benchmark';
import {
  caseSignature,
  judgmentSchema,
  parseRecordedBenchmark,
} from '../src/lib/recorded-benchmark';
const directory = '.wrangler/benchmark';
await mkdir(directory, { recursive: true });
const endpoint = '/api/judge';
const checkpoint = `${directory}/results.jsonl`;
type Record = { case: (typeof BENCHMARK)[number]; judgment: Judgment; durationMs?: number };
const results = new Map<string, Record>();
try {
  for (const line of (await readFile(checkpoint, 'utf8')).trim().split('\n').filter(Boolean)) {
    const record = JSON.parse(line) as Record;
    const expected = BENCHMARK.find((c) => c.id === record.case.id);
    judgmentSchema.parse(record.judgment);
    if (!expected || caseSignature(expected) !== caseSignature(record.case))
      throw new Error('Checkpoint case mismatch.');
    results.set(record.case.id, record);
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (!results.size) {
  try {
    // A saved first-case smoke check can be reused; it is never required.
    const smoke = JSON.parse(await readFile(`${directory}/smoke.json`, 'utf8')) as Record;
    judgmentSchema.parse(smoke.judgment);
    if (caseSignature(smoke.case) !== caseSignature(BENCHMARK[0]))
      throw new Error('Smoke case mismatch.');
    results.set(smoke.case.id, smoke);
    await appendFile(checkpoint, JSON.stringify(smoke) + '\n');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
console.log(`Resuming ${results.size}/600; 3 factual questions per case; no fixture substitution.`);
for (const flight of BENCHMARK) {
  if (results.has(flight.id)) continue;
  const start = Date.now();
  let completed = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://exceptionengine.ankitkapoor.me${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case: flight, thresholds: DEFAULT_THRESHOLDS }),
      signal: AbortSignal.timeout(30000),
    });
    const body = (await response.json()) as { judgment?: unknown; error?: string };
    if (!response.ok) {
      if ((response.status === 429 || body.error?.includes('rate limited')) && attempt < 3) {
        console.log(`Rate limited at ${flight.id}; waiting 60 seconds.`);
        await wait(60000);
        continue;
      }
      throw new Error(
        `${flight.id}: ${response.status} ${body.error ?? 'Request failed'}. Completed results remain checkpointed.`,
      );
    }
    const judgment = judgmentSchema.parse(body.judgment);
    const record = { case: flight, judgment, durationMs: Date.now() - start };
    await appendFile(checkpoint, JSON.stringify(record) + '\n');
    results.set(flight.id, record);
    completed = true;
    break;
  }
  if (!completed) throw new Error(`Incomplete case ${flight.id}.`);
  if (results.size % 25 === 0)
    console.log(`${results.size}/600 completed (${results.get(flight.id)!.judgment.model}).`);
  await wait(12500);
}
const records = BENCHMARK.map((c) => results.get(c.id)!);
const judgments = Object.fromEntries(records.map((r) => [r.case.id, r.judgment]));
const summary = summarize(
  BENCHMARK,
  DEFAULT_THRESHOLDS,
  { falseApproval: 400, falseDenial: 1200, review: 25 },
  judgments,
);
const snapshot = {
  schemaVersion: 1,
  seed: 2612004,
  caseCount: 600,
  startedAt: records.map((r) => r.judgment.timestamp).sort()[0],
  completedAt: new Date().toISOString(),
  models: [...new Set(records.map((r) => r.judgment.model))],
  questionVersion: 'facts-v1',
  thresholds: DEFAULT_THRESHOLDS,
  source: '600 real Jev assessments of synthetic cases',
  summary: {
    approve: summary.approve,
    deny: summary.deny,
    review: summary.review,
    automation: summary.automation,
    unlabeled: summary.unlabeled,
    labeledAutomated: summary.labeledAutomated,
    disagreements: summary.errors,
    modeledLoss: summary.expectedLoss,
  },
  records: records.map((r) => ({
    ...r,
    decision: evaluate(r.case, r.judgment, DEFAULT_THRESHOLDS),
  })),
};
parseRecordedBenchmark(snapshot);
await writeFile('public/benchmark/jev-results.json', JSON.stringify(snapshot) + '\n');
await writeFile(
  `${directory}/summary.json`,
  JSON.stringify({ ...snapshot, records: undefined }, null, 2) + '\n',
);
console.log(JSON.stringify({ ...snapshot, records: undefined }, null, 2));
