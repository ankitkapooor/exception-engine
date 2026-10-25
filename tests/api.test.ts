import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../worker/index';
import { judge } from '../worker/jev';
import { INITIAL_CASE } from '../src/lib/cases';
import { DEFAULT_THRESHOLDS } from '../src/lib/types';
const env: Env = { ASSETS: { fetch: async () => new Response('asset') } };
const configured: Env = {
  ...env,
  TYPESAFE_API_KEY: 'test-secret-never-real',
  LIVE_JEV_ENABLED: 'true',
  JEV_RATE_LIMITER: { limit: async () => ({ success: true }) },
};
const req = (body: unknown, headers = {}) =>
  new Request('https://example.com/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const valid = { case: INITIAL_CASE, thresholds: DEFAULT_THRESHOLDS };
test('health reports configuration without leaking secrets', async () => {
  const r = await worker.fetch(new Request('https://example.com/api/health'), configured);
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.ok(text.includes('"liveJevAvailable":true'));
  assert.ok(!text.includes('test-secret'));
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
test('unconfigured live mode returns actionable error, not fake live data', async () => {
  const r = await worker.fetch(req(valid), env);
  assert.equal(r.status, 503);
  assert.match(await r.text(), /TYPESAFE_API_KEY/);
});
test('invalid bodies and out-of-range facts rejected before upstream calls', async () => {
  for (const body of [
    {},
    { ...valid, case: { ...INITIAL_CASE, distanceKm: -1 } },
    { ...valid, thresholds: { approve: 1.1, deny: 0.9 } },
    { cases: Array(701).fill(INITIAL_CASE) },
  ]) {
    const r = await worker.fetch(req(body), configured);
    assert.ok(r.status === 400 || r.status === 413);
  }
  const r = await worker.fetch(
    new Request('https://example.com/api/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid',
    }),
    configured,
  );
  assert.equal(r.status, 400);
});
test('cross-origin, wrong method, unsupported content type, unknown endpoints', async () => {
  assert.equal(
    (await worker.fetch(req(valid, { Origin: 'https://attacker.example' }), configured)).status,
    403,
  );
  assert.equal(
    (await worker.fetch(new Request('https://example.com/api/judge'), configured)).status,
    405,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request('https://example.com/api/judge', { method: 'POST', body: '{}' }),
        configured,
      )
    ).status,
    415,
  );
  assert.equal(
    (await worker.fetch(new Request('https://example.com/api/unknown'), env)).status,
    404,
  );
});
test('live requests fail closed when limiter is missing or exceeded', async () => {
  assert.equal(
    (await worker.fetch(req(valid), { ...configured, JEV_RATE_LIMITER: undefined })).status,
    503,
  );
  assert.equal(
    (
      await worker.fetch(req(valid), {
        ...configured,
        JEV_RATE_LIMITER: { limit: async () => ({ success: false }) },
      })
    ).status,
    429,
  );
});
const mock =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });
const response = {
  model: 'jev-test',
  answers: {
    extraordinary: { type: 'noul', noul: 0.2 },
    evidence: {
      type: 'score',
      score: 2.8,
      confidence: 0.97,
      probabilities: { '0': 0, '1': 0, '2': 0.2, '3': 0.8 },
    },
    clarity: { type: 'score', score: 3, confidence: 0.99 },
  },
};
test('Jev adapter uses official wire format and preserves model metadata', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    const body = JSON.parse(init!.body as string);
    assert.equal(body.questions.extraordinary.type, 'noul');
    assert.equal(body.questions.evidence.criteria.length, 4);
    assert.equal(Object.keys(body.questions).length, 3);
    assert.ok(!('thresholds' in body.state));
    return Response.json(response);
  };
  const j = await judge(INITIAL_CASE, 'test', 'jev-latest', fetcher);
  assert.equal(j.mode, 'live');
  assert.equal(j.model, 'jev-test');
  assert.equal(j.extraordinaryProbability, 0.2);
  assert.equal(j.evidenceScore, 2.8);
});
test('Jev malformed responses fail closed; failures do not echo upstream secrets', async () => {
  await assert.rejects(judge(INITIAL_CASE, 'test', 'jev-latest', mock({})), /unexpected response/);
  await assert.rejects(
    judge(
      INITIAL_CASE,
      'test',
      'jev-latest',
      mock({
        ...response,
        answers: { ...response.answers, extraordinary: { type: 'noul', noul: 4 } },
      }),
    ),
    /unexpected response/,
  );
  await assert.rejects(
    judge(INITIAL_CASE, 'test', 'jev-latest', mock({ secret: 'do-not-echo' }, 401)),
    /server API key/,
  );
  await assert.rejects(judge(INITIAL_CASE, 'test', 'jev-latest', mock({}, 429)), /rate limited/);
});
