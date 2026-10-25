# Methodology — policy, probability, people

The Exception Engine is a portfolio experiment in uncertainty-aware automation. It demonstrates a separation of responsibilities, not production legal adjudication.

## Four layers

1. **Known facts:** supplied route coverage flags, carrier, distance, event, delay, notice, rerouting, evidence narrative.
2. **Derived facts:** coverage, timing exemptions, compensation bracket, reduction, care threshold.
3. **Uncertain judgments:** evidence for an external/unavoidable cause with reasonable measures, evidence sufficiency, cause clarity.
4. **Operational result:** deterministic application of policy plus confidence gates gives APPROVE, DENY, or REVIEW.

AI receives the cause narrative, evidence completeness, and disruption category. It is never asked to award compensation or reinterpret the whole regulation. Prompts define evidence-assessment rubrics; they are not a policy compiler. Known facts do not need a model call. The UI disables live assessment when the decision is already determined by known facts.

## Bounded policy scope

Version `EU261-lab/1.0.0` models a single flight, confirmed reservation, timely check-in, and valid travel documents. EU departure is covered regardless of operating carrier; a non-EU departure is modeled only for an EU arrival on an EU carrier. Users flag connecting itineraries, overseas-territory issues, prior non-EU benefits, or other disputed scope for individual review. The scope flag takes precedence over the simplified route calculation.

### Deterministic rules

| Rule | Implementation | Source |
| --- | --- | --- |
| Coverage | EU departure, or EU arrival on EU carrier | Art. 3 |
| Cancellation notice | At least 14 days removes modeled compensation | Art. 5(1)(c)(i) |
| 7–14 day rerouting | Departure no more than 120 min early AND arrival strictly less than 240 min late | Art. 5(1)(c)(ii) |
| Under 7 day rerouting | Departure no more than 60 min early AND arrival strictly less than 120 min late | Art. 5(1)(c)(iii) |
| Arrival delay | At least 180 min; extraordinary circumstances assessed separately | Official Commission guidance on long delays |
| Amount | €250 at ≤1,500 km; €400 for intra-EU >1,500 km or other flights ≤3,500 km; otherwise €600 | Art. 7(1) |
| Rerouting reduction | 50% reduction when arrival is within 2 / 3 / 4 h for the corresponding bracket | Art. 7(2) |
| Long-haul delay | €300 for non-intra-EU >3,500 km at 3–<4 h; €600 at ≥4 h | Official Commission guidance |
| Denied boarding | Only involuntary overbooking with valid documents and timely check-in; other grounds go to REVIEW | Art. 4 and official guidance |
| Care | Assessed separately; cancellation/overbooking care while awaiting earliest rerouting; delay departure-wait thresholds 2 / 3 / 4 h | Arts. 5, 6, 8, 9 |

Cancellation compensation exemption and compensation reduction have different boundary operators. E.g. 239 min can meet the 7–14 day rerouting exemption, while 240 min cannot. The €400 bracket reduction uses ≤180 min. A non-intra-EU long-haul delay reaches full €600 at 240 min; the ≤240 min rerouting reduction for cancellation/denied boarding is a separate rule.

Health, safety, invalid documents, voluntary boarding surrender, multi-leg travel, contested facts, and jurisdiction edge cases are not automatically approved or denied by the overbooking rule. Care is a general informational assessment, not a detailed calculation of expenses, accommodation, or reimbursement entitlements. Coverage outside this bounded model does not imply no rights exist elsewhere.

Sources: [Regulation 261/2004](https://eur-lex.europa.eu/eli/reg/2004/261/oj/eng) and [official Your Europe guidance](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/). Source snapshot 25 October 2026; this is a versioned educational model. It does not track future changes automatically.

## Jev questions and confidence

Question version `facts-v1` sends one Noul and two four-level Scores in one request to the [official endpoint](https://docs.typesafe.ai/primitives/noul):

- **Noul:** evidence for external cause + causal link + unavoidability despite reasonable measures. Returns `noul` from 0 to 1. Noul has no independent confidence field.
- **Evidence Score:** 0 = absent, 1 = major gaps/conflicts, 2 = enough for provisional assessment, 3 = strong documentary support.
- **Cause clarity Score:** 0 = unknown, 1 = weak indication, 2 = reasonably clear, 3 = explicit and supported.

[Score](https://docs.typesafe.ai/primitives/score) answers may be fractional and carry a confidence plus per-level probabilities. All returned probabilities, scores, model names, and confidence ranges are validated. Model-provided distributions are shown when available and included in receipts.

For cases needing an uncertain factual judgment:

```text
sided support = p(extraordinary) if p ≥ 0.5, otherwise 1 − p
strength = min(sided support, evidence score confidence, cause clarity confidence)
```

Evidence score and clarity score must both be ≥2. Then the strength must meet the relevant gate: default 90% for approval, 98% for denial. Any shortfall means REVIEW. Known-fact exclusions and qualifying overbooking do not depend on Jev and receive deterministic strength 100%.

The minimum is a conservative **application heuristic**, not a calibrated joint probability or a statistical guarantee. The cost model below uses it as an illustrative proxy. An actual production system needs held-out calibration, legal validation and monitored human review. The model assesses factual support; it does not establish an airline’s legal burden of proof.

The SDK default `jev-latest` is an alias that may change. A receipt records the actual returned model and question version; use a pinned model setting when available for a reproducible live study. Narrative edits invalidate prior live assessments. Async responses for an earlier case are discarded. Changing risk thresholds can reuse judgments because the factual questions do not depend on those thresholds.

## Synthetic benchmark

Exactly **600 generated scenarios** with a seeded generator (`2612004`). No full dataset is loaded or tested. Generator requests above **700** are rejected. Case inspection, economic simulations, and export reuse these records. Re-evaluating thresholds does not create new cases or call Jev.

The generator samples timing/distance values around boundaries, coverage/carrier flags, disruption type, rerouting, cause, evidence strength, and boarding grounds. Route labels are illustrative; distance is an independently editable input rather than a geographic calculation. It is not representative of real passenger claims or incident prevalence.

Five hand-authored cause families carry fixed illustrative extraordinary probabilities: maintenance 0.025, documented external airport closure 0.995, conflicting causes 0.37, crew scheduling 0.04, unknown cause 0.5. Evidence / clarity scores are also fixtures. These are not Jev inferences, measurements, or calibrated predictions. Editing narrative text in demo mode does not change them.

For clear cause scenarios, controlled labels fix the external-cause fact and use the policy engine to derive a reference consequence. For ambiguous causes, only outcomes completely determined by known structured facts are labeled. Remaining ambiguous cases have `truth: null`; no binary truth is fabricated. Benchmark agreement is an internal consistency check because labels reuse policy code. Independent boundary tests provide separate expected values for the deterministic implementation, but not expert legal validation.

## Risk and economics

Inputs: cost of wrongful approval, cost of wrongful denial, and human review. No cost of processing or turnaround is modeled (both fixed at €0).

```text
modeled loss = reviews × review cost
             + sum over labeled automated cases:
               (1 − decision strength) × cost of that decision's mistake
```

Deterministic cases have zero modeled error probability. Unlabeled cases are excluded from error counts and automated mistake-loss estimates; their reviews still incur review costs. Current fixtures keep the uncertain unlabeled cases in review. If a future fixture allows unlabeled automation, that loss is unestimated, not zero-risk evidence.

An internal disagreement count compares binary automated outcomes with controlled labels and reports its labeled-automated denominator. It is not live Jev accuracy. The frontier plots automation rate against modeled total loss for 11 sampled threshold pairs, with denial four percentage points more conservative (capped at 100%). “Lowest modeled loss” means lowest among those 11 candidates under these assumptions, not a continuous/global optimum or an empirical business result.

Costs may change the selected candidate. Evidence floors remain hard gates even when confidence thresholds fall. Each case’s complete rule chain, source links, model metadata, and risk thresholds are available in its JSON receipt.

## Operational simplicity

One Cloudflare Worker, browser-local synthetic data, no database or authentication. No API key is shipped to the browser. The live endpoint accepts one validated case, limits requests to 16 KB, rejects cross-origin browser calls, uses a 20-second upstream timeout and a per-location 5/minute limiter, and fails closed on bad responses. There is no paid bulk endpoint. Per-location limits are not a global spending cap; enabling a public paid demo still requires owner monitoring.

No real key was used in automated checks. Tests mock the official TypeSafe request/response contract. After adding the secret, manually validate one live response in the case explorer. No private passenger data is needed or requested.
