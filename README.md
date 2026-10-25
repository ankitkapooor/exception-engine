# The Exception Engine

**Rules are easy. Exceptions are expensive.**

An interactive policy laboratory by [Ankit Kapoor](https://ankitkapoor.me). Explore where deterministic rules stop being enough: AI assesses uncertain facts, code applies the policy, and people resolve ambiguity.

**Live app:** [exceptionengine.ankitkapoor.me](https://exceptionengine.ankitkapoor.me)

This is an educational simulation using fictional cases and a bounded model of EU air-passenger compensation. It does not assess real claims or provide legal advice.

## What works

- Boundary explorer with instant counterfactuals, scenario presets, coverage controls, cancellation / delay / denied-boarding cases, source-linked rule trails, and explanations of what would change the outcome.
- First-class **AUTO APPROVE**, **AUTO DENY**, and **REVIEW** states.
- A decision surface with **600 reproducible synthetic cases**, case search/filtering, and a complete JSON export.
- Separate approval / denial confidence thresholds, mistake-cost assumptions, and a small automation frontier with an explicit expected-loss calculation.
- Decision receipts with case snapshots, judgments, thresholds, provenance, JSON download, and print / save-to-PDF.
- Optional server-side Jev assessments: three bounded factual questions, never an AI compensation decision.
- Responsive layouts, keyboard controls, live decision announcements, reduced-motion support, and a searchable text equivalent of the scatterplot.

The app includes **600 recorded Jev assessments of synthetic cases**. The decision surface and risk lab use these saved model outputs; inspecting and adjusting thresholds makes no repeat API calls. The case explorer uses a recorded assessment only when every case field matches. Edited / custom cases fall back to labeled demo fixtures until you explicitly run a fresh live assessment. No API key is needed for visitors to explore the recorded results.

## Add your JEV API key

Your JEV key is called **`TYPESAFE_API_KEY`** in this project. It stays on the server; never put it in a `VITE_` variable or the frontend.

### On the deployed site

1. Open [Cloudflare → Workers & Pages → exception-engine → Settings → Variables and Secrets](https://dash.cloudflare.com/2aa82d87fe21472b7c89953238f0cf6f/workers/services/view/exception-engine/production/settings).
2. Add a variable of type **Secret** named **`TYPESAFE_API_KEY`**. Paste your JEV / TypeSafe API key as the value, then save/deploy the change.
3. Reload the app. Choose a case needing a factual judgment, then click **Assess with live Jev**. Loading the page, changing sliders, and exploring the recorded benchmark never trigger paid calls.

`JEV_MODEL` defaults to `jev-latest`; the receipt records the actual model returned by the API. `LIVE_JEV_ENABLED` defaults to `true`, but live mode remains unavailable until the secret exists. Set it to `false` in `wrangler.jsonc` and redeploy to disable live calls.

CLI alternative (prompts for the key without putting it in shell history):

```sh
npx wrangler secret put TYPESAFE_API_KEY
```

There is no key included in this repository. The deployed key was verified successfully, then all 600 benchmark cases were assessed by Jev (three factual questions each). The complete recorded run is in `public/benchmark/jev-results.json`, including exact cases, returned model versions, timestamps, score distributions, and default-threshold decisions. Automated tests use mocks and the saved run; they do not spend API credits.

### Locally

Requires Node.js 22.15+ (Node 24 recommended).

```sh
npm ci
npm run check
npm run preview
```

Open `http://127.0.0.1:8787`. To enable local live assessments:

```sh
cp .dev.vars.example .dev.vars
```

Open **`.dev.vars`**, paste your key after **`TYPESAFE_API_KEY=`**, and restart `npm run preview`. `.dev.vars` is gitignored. `npm run preview` serves the last built frontend plus the Worker API. Run `npm run build` after frontend changes. `npm run dev` provides faster frontend-only hot reload; live API requests need the Worker preview.

## Simple architecture

```text
React + TypeScript (Vite)
  ├─ Pure policy functions → explicit, source-linked decisions
  ├─ Seeded synthetic cases → browser-only benchmark / risk exploration
  └─ POST /api/judge → Cloudflare Worker → TypeSafe Jev
                          └─ validated facts → same deterministic policy
```

One Cloudflare Worker serves static assets and the optional API on the same domain. There is no database, volume, background job, or Railway service. Nothing is stored server-side. Cloudflare operational logs may contain request metadata; the app does not log case narratives or keys. Downloads are generated in the browser.

| Path | Purpose |
| --- | --- |
| `src/lib/policy.ts` | Deterministic policy, compensation, care, and audit rules |
| `src/lib/cases.ts` | Seeded generator, 600-record benchmark, demo judgments |
| `src/lib/benchmark.ts` | Controlled labels, cost model, frontier using recorded or fixture judgments |
| `src/lib/recorded-benchmark.ts` | Validates all 600 exact case snapshots and Jev provenance |
| `public/benchmark/jev-results.json` | The completed real Jev run on synthetic cases |
| `scripts/run-jev-benchmark.ts` | Resumable one-case-at-a-time benchmark runner |
| `src/lib/types.ts` | Shared schema, thresholds, hard 700-case limit |
| `worker/jev.ts` | Three atomic Jev questions; validated response adapter |
| `worker/index.ts` | Same-origin API, input limits, rate limit, failure handling |
| `src/App.tsx` | Interactive laboratory and receipt |
| `docs/methodology.md` | Scope, provenance, limits, and economic assumptions |

## Dataset and validation limits

The benchmark contains **600 records**, not the 5,000+ suggested by the source PRD. The generator rejects requests above **700**. Only these 600 cases were evaluated with Jev; no larger dataset is loaded or tested. Tests reuse this bounded benchmark plus focused boundary fixtures.

Fixtures include 1,499 / 1,500 / 1,501 km, 3,499 / 3,500 / 3,501 km, 179 / 180 / 181 minutes, and notice/rerouting boundaries. The generator is deterministic (seed `2612004`). All fallback demo probabilities are illustrative. The recorded benchmark contains actual Jev probabilities, but the app’s conservative decision-strength heuristic is **not a calibrated error probability**. Some intentionally ambiguous cases have no binary ground truth. The engine and synthetic labeler share policy code; their agreement is an internal consistency check, not independent legal validation.

```sh
npm test          # policy boundaries and API/adapter tests; no network or live key
npm run build     # TypeScript check + optimized frontend
npm run check     # both
```

## Deploy

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` targets the owner’s Cloudflare account and provisions the exact custom domain `exceptionengine.ankitkapoor.me`. Cloudflare manages the domain’s DNS and TLS. Change the account and route before deploying a fork. Existing secrets survive normal Worker deployments.

GitHub Actions checks tests and the build on pushes / PRs. Deployment is intentionally an explicit `npm run deploy`; no GitHub deployment secret or new access credential is required.

Live calls are limited to **5 requests per minute per Cloudflare location across visitors**. This is an abuse guard, **not a global daily or spending cap**. The public API accepts only individual cases; there is no public paid batch endpoint. The completed owner-authorized run used a temporary authenticated route, which was removed after completion along with its token. Upstream failures, missing keys, rate limits, incomplete evidence, and malformed model responses never silently turn into a successful live assessment.

## Recorded JEV benchmark

[Read the completed run report](docs/jev-benchmark.md).

[Download the complete 600-case run](https://exceptionengine.ankitkapoor.me/benchmark/jev-results.json). Its summary records approval, denial, review, controlled-label disagreements, and modeled loss at the default 90% / 98% gates. Fictional cases remain synthetic; the judgments are real Jev responses.

To run or resume a future evaluation using the public single-case endpoint:

```sh
npm run benchmark:jev
```

This can incur model charges. It checkpoints each success under the gitignored `.wrangler/benchmark/` directory and skips completed case IDs after verifying their snapshots. A fresh run follows the public five-per-minute limit (roughly two hours for 600). It never creates more than the fixed 600 scenarios or substitutes fixtures for a failed Jev call. The owner’s API key stays in Cloudflare; no local copy is required. To intentionally start a new evaluation, archive the existing checkpoint directory first. After completion, review the changed JSON, run `npm run check`, and deploy it.

## Sources and scope

Policy version: **EU261-lab/1.0.0**. Source snapshot: **25 October 2026**.

- [Regulation (EC) No 261/2004](https://eur-lex.europa.eu/eli/reg/2004/261/oj/eng), Articles 3, 4, 5, 6, 7, 8 and 9.
- [European Commission / Your Europe passenger-rights guidance](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/) for long arrival delays and operational guidance.
- [Official TypeSafe Jev documentation](https://docs.typesafe.ai/) and [official JavaScript SDK contract](https://github.com/typesafe-ai/typesafe-sdk-js) for request/response shapes.

Read [the methodology](docs/methodology.md) before interpreting results. Scope is single-leg EU journeys; disputed jurisdiction, connecting itineraries, overseas territories, and prior non-EU compensation are sent to review. Proposed legislative changes are not modeled as enacted rules.

Fonts (Inter, Instrument Serif, IBM Plex Mono) are hosted locally under the SIL Open Font License; license texts are in `public/fonts/`.
