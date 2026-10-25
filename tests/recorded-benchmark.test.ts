import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BENCHMARK } from '../src/lib/cases';
import { DEFAULT_THRESHOLDS } from '../src/lib/types';
import { parseRecordedBenchmark } from '../src/lib/recorded-benchmark';
import { summarize, frontier } from '../src/lib/benchmark';
const raw = JSON.parse(readFileSync('public/benchmark/jev-results.json', 'utf8'));
const snapshot = parseRecordedBenchmark(raw);
const judgments = Object.fromEntries(snapshot.records.map((r) => [r.case.id, r.judgment]));
const costs = { falseApproval: 400, falseDenial: 1200, review: 25 };
test('recorded run has exactly 600 matching cases with real Jev provenance', () => {
  assert.equal(snapshot.records.length, 600);
  assert.equal(new Set(snapshot.records.map((r) => r.case.id)).size, 600);
  assert.ok(
    snapshot.records.every(
      (r) => r.judgment.mode === 'live' && r.judgment.model.startsWith('jev-'),
    ),
  );
  assert.deepEqual(
    [...new Set(snapshot.records.map((r) => r.judgment.model))].sort(),
    [...snapshot.models].sort(),
  );
  assert.ok(Date.parse(snapshot.completedAt) >= Date.parse(snapshot.startedAt));
});
test('recorded source rejects partial, duplicated, tampered and synthetic results', () => {
  assert.throws(() => parseRecordedBenchmark({ ...raw, records: raw.records.slice(0, 599) }));
  const duplicate = [...raw.records];
  duplicate[1] = duplicate[0];
  assert.throws(() => parseRecordedBenchmark({ ...raw, records: duplicate }));
  const tampered = [...raw.records];
  tampered[0] = { ...tampered[0], case: { ...tampered[0].case, arrivalDelay: 999 } };
  assert.throws(() => parseRecordedBenchmark({ ...raw, records: tampered }));
  const fake = [...raw.records];
  fake[0] = { ...fake[0], judgment: { ...fake[0].judgment, mode: 'demo' } };
  assert.throws(() => parseRecordedBenchmark({ ...raw, records: fake }));
});
test('surface, risk and exports use the recorded judgments, not demo fixtures', () => {
  const stats = summarize(BENCHMARK, DEFAULT_THRESHOLDS, costs, judgments);
  assert.equal(stats.approve, raw.summary.approve);
  assert.equal(stats.deny, raw.summary.deny);
  assert.equal(stats.review, raw.summary.review);
  assert.equal(stats.errors, raw.summary.disagreements);
  assert.equal(stats.approve + stats.deny + stats.review, 600);
  assert.ok(stats.results.every((r) => r.judgment === judgments[r.case.id]));
  for (const policy of frontier(BENCHMARK, costs, judgments))
    assert.ok(policy.results.every((r) => r.judgment.mode === 'live'));
});
