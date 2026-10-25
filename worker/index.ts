import { z } from 'zod';
import { caseSchema, thresholdSchema, MAX_CASES } from '../src/lib/types';
import { evaluate, POLICY_VERSION } from '../src/lib/policy';
import { judge } from './jev';
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TYPESAFE_API_KEY?: string;
  JEV_MODEL?: string;
  LIVE_JEV_ENABLED?: string;
  JEV_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
const schema = z.object({ case: caseSchema, thresholds: thresholdSchema });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health' && request.method === 'GET')
      return json({
        ok: true,
        policyVersion: POLICY_VERSION,
        maxCases: MAX_CASES,
        liveJevAvailable: !!env.TYPESAFE_API_KEY && env.LIVE_JEV_ENABLED === 'true',
      });
    if (url.pathname !== '/api/judge') return json({ error: 'Endpoint not found.' }, 404);
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin)
      return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    if (!request.headers.get('Content-Type')?.includes('application/json'))
      return json({ error: 'Send application/json.' }, 415);
    if (!env.TYPESAFE_API_KEY || env.LIVE_JEV_ENABLED !== 'true')
      return json(
        {
          error:
            'Live Jev is not configured. Add TYPESAFE_API_KEY and enable LIVE_JEV_ENABLED in the Cloudflare Worker settings. The synthetic demo works without a key.',
        },
        503,
      );
    // Streaming limit also covers clients omitting or lying about Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'A JSON body is required.' }, 400);
    let raw = '',
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        return json({ error: 'Request exceeds 16 KB.' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON.' }, 400);
    }
    const input = schema.safeParse(body);
    if (!input.success)
      return json(
        { error: 'Invalid case or thresholds. Check numeric ranges and required facts.' },
        400,
      );
    if (!env.JEV_RATE_LIMITER)
      return json({ error: 'Live request limiter is unavailable. Please use the demo.' }, 503);
    // Global per-location limit bounds paid calls; the full benchmark never invokes Jev.
    const limit = await env.JEV_RATE_LIMITER.limit({ key: 'jev-global' });
    if (!limit.success)
      return json(
        {
          error:
            'Live demo limit reached (5 calls/minute per Cloudflare location). Please wait before retrying.',
        },
        429,
      );
    try {
      const judgment = await judge(
        input.data.case,
        env.TYPESAFE_API_KEY,
        env.JEV_MODEL || 'jev-latest',
      );
      return json({
        judgment,
        decision: evaluate(input.data.case, judgment, input.data.thresholds),
      });
    } catch (error) {
      // Never return upstream bodies or headers; they may contain sensitive information.
      const message =
        error instanceof Error && error.name !== 'TimeoutError'
          ? error.message
          : 'Jev request timed out. Please try again.';
      return json(
        {
          error: message.startsWith('Jev ')
            ? message
            : 'Jev request failed. The synthetic demo remains available.',
        },
        502,
      );
    }
  },
};
