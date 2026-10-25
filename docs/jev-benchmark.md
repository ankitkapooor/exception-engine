# Recorded JEV run — 600 cases

The deployed TypeSafe API key was verified successfully, and **all 600 fixed benchmark cases** were assessed with **`jev-1.14.0`**, using question version `facts-v1`. Each request contained one Noul and two Score questions: **1,800 factual assessments** total. The successful first-case verification was reused, followed by the remaining 599 cases. No case failed or used a fallback fixture.

Run window: `2026-10-25T10:29:26.582Z` to `2026-10-25T10:34:27.918Z`. Cases are synthetic, seed `2612004`; model judgments are real recorded responses.

At default approval / denial thresholds of **90% / 98%**:

| Outcome | Cases | Share |
| --- | ---: | ---: |
| Auto approve | 91 | 15.2% |
| Auto deny | 200 | 33.3% |
| Human review | 309 | 51.5% |
| **Total** | **600** | **100%** |

Automation rate: **48.5%**. There were **0 disagreements among 291 automated cases with controlled labels**. Another **175 cases have no binary truth label**; they are excluded from disagreement calculations. These are synthetic labels derived using the policy code, not an independent legal accuracy or calibration evaluation. All 600 cases were sent to Jev even where known facts already determined the policy outcome.

The example loss model yields **€7,725**, entirely human-review cost at €25 per reviewed case under these thresholds. This is a modeled operational loss, not the API bill. The model excludes actual API expenditure and uses a conservative decision-strength heuristic rather than calibrated error probability.

[Complete run JSON](../public/benchmark/jev-results.json) includes exact cases, real judgments, distributions, actual model and question versions, timestamps, and default decisions. [Download the deployed artifact](https://exceptionengine.ankitkapoor.me/benchmark/jev-results.json).

The decision surface, risk lab, and matching case inspections reuse these outputs without additional model calls. Case changes invalidate the stored match and show an explicit fixture label until the visitor requests a new live assessment. The temporary owner-only batch route and token were removed after the run; the normal public five-per-minute limit remains.
