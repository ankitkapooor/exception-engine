import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  RotateCcw,
  Download,
  FileText,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Check,
  X,
  CircleHelp,
  Plane,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  Fingerprint,
  Circle,
  Scale,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { BENCHMARK, CAUSES, demoJudgment, INITIAL_CASE, PRESETS } from './lib/cases';
import { evaluate, GUIDANCE, REGULATION } from './lib/policy';
import { frontier, summarize, type Costs } from './lib/benchmark';
import {
  parseRecordedBenchmark,
  caseSignature,
  type RecordedBenchmark,
} from './lib/recorded-benchmark';
import {
  DEFAULT_THRESHOLDS,
  type Decision,
  type FlightCase,
  type Judgment,
  type Outcome,
  type Thresholds,
} from './lib/types';

const pct = (n: number) => `${Number((n * 100).toFixed(1))}%`;
const eur = (n: number) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
const GITHUB = 'https://github.com/ankitkapooor/exception-engine';
const LABELS: Record<Outcome, string> = {
  APPROVE: 'Auto approve',
  DENY: 'Auto deny',
  REVIEW: 'Human review',
};
function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
function Slider({
  label,
  value,
  min = 0,
  max,
  step = 1,
  suffix = '',
  onChange,
  marks,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (n: number) => void;
  marks?: string;
}) {
  const id = label.replaceAll(' ', '-').toLowerCase();
  return (
    <div className="slider-field">
      <div className="field-line">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value.toLocaleString()}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
      <div className="range-marks">
        <span>
          {min}
          {suffix}
        </span>
        <span>{marks}</span>
        <span>
          {max.toLocaleString()}
          {suffix}
        </span>
      </div>
    </div>
  );
}
function Stamp({ outcome, small = false }: { outcome: Outcome; small?: boolean }) {
  return (
    <span className={`stamp ${outcome.toLowerCase()} ${small ? 'small' : ''}`}>
      {outcome === 'REVIEW' ? 'REVIEW' : `AUTO ${outcome}`}
    </span>
  );
}
function StatusIcon({ state }: { state: string }) {
  return state === 'pass' ? (
    <Check size={15} />
  ) : state === 'fail' ? (
    <X size={15} />
  ) : (
    <CircleHelp size={15} />
  );
}

export default function App() {
  const [flight, setFlight] = useState<FlightCase>(INITIAL_CASE);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [tab, setTab] = useState<'explorer' | 'surface' | 'risk'>('explorer');
  const [live, setLive] = useState<Judgment | null>(null);
  const [benchmark, setBenchmark] = useState<RecordedBenchmark | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState('loading');
  const recordedCases = useMemo(
    () => new Map(benchmark?.records.map((r) => [r.case.id, r]) ?? []),
    [benchmark],
  );
  const recordedJudgments = useMemo(
    () =>
      benchmark
        ? Object.fromEntries(benchmark.records.map((r) => [r.case.id, r.judgment]))
        : undefined,
    [benchmark],
  );
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('Change a fact. Watch the rule respond.');
  const [costs, setCosts] = useState<Costs>({ falseApproval: 400, falseDenial: 1200, review: 25 });
  const [receipt, setReceipt] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);
  const matchingRecord = recordedCases.get(flight.id);
  const recorded =
    matchingRecord && caseSignature(matchingRecord.case) === caseSignature(flight)
      ? matchingRecord.judgment
      : null;
  const judgment = live ?? recorded ?? demoJudgment(flight);
  const hasJev = judgment.mode === 'live';
  const isRecorded = !live && !!recorded;
  const decision = useMemo(
    () => evaluate(flight, judgment, thresholds),
    [flight, judgment, thresholds],
  );
  const stats = useMemo(
    () => summarize(BENCHMARK, thresholds, costs, recordedJudgments),
    [thresholds, costs, recordedJudgments],
  );
  const policies = useMemo(
    () => frontier(BENCHMARK, costs, recordedJudgments),
    [costs, recordedJudgments],
  );
  const optimal = policies.reduce(
    (best, p) => (p.expectedLoss < best.expectedLoss ? p : best),
    policies[0],
  );
  const previous = useRef(decision);
  const [boundary, setBoundary] = useState(false);
  const [receiptTime, setReceiptTime] = useState('');
  useEffect(() => {
    fetch('/benchmark/jev-results.json')
      .then((r) => {
        if (!r.ok) throw new Error('No recorded benchmark');
        return r.json();
      })
      .then((data) => {
        setBenchmark(parseRecordedBenchmark(data));
        setBenchmarkStatus('ready');
        if (requestVersion.current === 0) {
          setFlight(BENCHMARK[0]);
          setNotice('Loaded 600 recorded Jev assessments. Inspect a case or change a fact.');
        }
      })
      .catch(() => setBenchmarkStatus('unavailable'));
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setLiveAvailable(d.liveJevAvailable === true))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (previous.current.outcome !== decision.outcome) {
      setNotice(
        `Boundary crossed: ${LABELS[previous.current.outcome]} → ${LABELS[decision.outcome]}. ${decision.reason}`,
      );
      setBoundary(true);
      const timer = setTimeout(() => setBoundary(false), 2200);
      previous.current = decision;
      return () => clearTimeout(timer);
    }
    previous.current = decision;
  }, [decision]);
  useEffect(() => {
    if (receipt) {
      setReceiptTime(new Date().toISOString());
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [receipt]);
  const update = (patch: Partial<FlightCase>, description?: string) => {
    requestVersion.current++;
    setLoading(false);
    setFlight((c) => ({ ...c, ...patch }));
    setLive(null);
    setNotice(description ?? 'Facts updated. The deterministic rules have been recalculated.');
  };
  const selectCase = (c: FlightCase) => {
    update(
      c,
      recordedCases.has(c.id) && caseSignature(recordedCases.get(c.id)!.case) === caseSignature(c)
        ? `Opened ${c.id} with its recorded Jev assessment. No new API call.`
        : `Opened ${c.id}. Using synthetic fixtures until a live assessment is requested.`,
    );
    setTab('explorer');
    document.getElementById('laboratory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const crossBoundary = () => {
    if (flight.event === 'cancellation')
      update(
        { noticeDays: flight.noticeDays >= 14 ? 13 : 14 },
        `Changed one fact: notice ${flight.noticeDays} → ${flight.noticeDays >= 14 ? 13 : 14} days.`,
      );
    else if (flight.event === 'delay')
      update(
        { arrivalDelay: flight.arrivalDelay >= 180 ? 179 : 180 },
        `Changed one fact: arrival delay ${flight.arrivalDelay} → ${flight.arrivalDelay >= 180 ? 179 : 180} minutes.`,
      );
    else
      update(
        { boardingReason: flight.boardingReason === 'overbooking' ? 'unknown' : 'overbooking' },
        'Changed one fact: the grounds for denied boarding.',
      );
  };
  const runLive = async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setNotice('Jev is assessing three factual questions. Policy remains code.');
    try {
      const response = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case: flight, thresholds }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok) throw new Error(data.error || 'The live assessment failed.');
      setLive(data.judgment);
      setNotice('Live Jev assessment received. The deterministic policy engine applied the rules.');
    } catch (error) {
      if (version === requestVersion.current) {
        setLive(null);
        setNotice(error instanceof Error ? error.message : 'The live assessment failed.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };
  const receiptData = (timestamp = new Date().toISOString()) => ({
    timestamp,
    simulation: true,
    case: flight,
    judgment,
    thresholds,
    decision,
  });
  const visibleCases = stats.results.filter(
    (r) =>
      (filter === 'all' || r.decision.outcome === filter) &&
      `${r.case.id} ${r.case.origin} ${r.case.destination} ${r.case.cause}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  return (
    <>
      <a href="#laboratory" className="skip-link">
        Skip to the laboratory
      </a>
      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-symbol">
            E<span>↗</span>
          </span>
          <span>
            THE EXCEPTION
            <br />
            ENGINE<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#laboratory" onClick={() => setTab('explorer')}>
            The laboratory
          </a>
          <a href="#methodology">How it works</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="github-link">
            View source <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> A LABORATORY FOR THE GREY AREAS
            </div>
            <h1>
              Rules are easy.
              <br />
              <em>Exceptions</em>
              <br />
              are expensive.
            </h1>
            <p>
              Software knows the rules. AI interprets the uncertainty.
              <br className="desktop" /> But who knows when to ask a human?
            </p>
            <a href="#laboratory" className="button primary" onClick={() => setTab('explorer')}>
              Explore the decision boundary <ArrowRight size={17} />
            </a>
            <span className="hero-caption">EU air passenger rights · A working experiment</span>
          </div>
          <div
            className="hero-visual"
            aria-label="Architecture: known facts pass through policy rules and uncertain judgments to a human review decision."
          >
            <div className="visual-grid" />
            <div className="dossier-preview">
              <div className="paper-top">
                <span>EXCEPTION ENGINE / CASE OFFICE</span>
                <Fingerprint size={23} />
              </div>
              <div className="paper-title">
                <span>CASE FILE</span>
                <strong>EE–0001</strong>
              </div>
              <div className="preview-route">
                BCN <Plane size={20} /> BER
              </div>
              <p>
                One cancellation.
                <br />
                Two conflicting accounts.
              </p>
              <div className="preview-check">
                <Check size={14} /> Journey covered <span>ART. 3</span>
              </div>
              <div className="preview-check">
                <Check size={14} /> Notice rule checked <span>ART. 5</span>
              </div>
              <div className="preview-check uncertain">
                <CircleHelp size={14} /> Extraordinary cause? <span>37% YES</span>
              </div>
              <div className="preview-stamp">
                <Stamp outcome="REVIEW" />
              </div>
              <div className="paper-bottom">THE RULE IS DETERMINISTIC. THE FACT ISN’T.</div>
            </div>
            <div className="margin-note">
              <span>←</span> This is where
              <br />
              judgment begins.
            </div>
            <div className="visual-note">
              <span className="live-dot" /> HUMAN REVIEW IS A VALID OUTCOME
            </div>
          </div>
        </section>
        <div className="principles wrap">
          <div>
            <span>01</span>
            <p>
              <strong>Policy stays in code.</strong>
              <br />
              Explicit rules. Inspectable consequences.
            </p>
            <GitBranch size={22} />
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>AI assesses the facts.</strong>
              <br />
              Bounded questions. Visible uncertainty.
            </p>
            <Sparkles size={22} />
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>People handle the grey.</strong>
              <br />
              Confidence decides when to escalate.
            </p>
            <Fingerprint size={22} />
          </div>
        </div>

        <section id="laboratory" className="laboratory wrap">
          <div className="section-intro">
            <div>
              <div className="eyebrow">THE INTERACTIVE LABORATORY</div>
              <h2>
                Find the point where
                <br className="mobile" /> the rule gives way.
              </h2>
              <p>Adjust the facts, inspect the reasoning, and decide how much to automate.</p>
            </div>
            <div
              className={`mode-label ${(tab === 'explorer' ? hasJev : !!benchmark) ? 'is-live' : ''}`}
            >
              <span className="live-dot" />{' '}
              {tab !== 'explorer'
                ? benchmark
                  ? 'RECORDED JEV · 600 CASES'
                  : benchmarkStatus === 'loading'
                    ? 'LOADING JEV BENCHMARK'
                    : 'SYNTHETIC FALLBACK'
                : hasJev
                  ? isRecorded
                    ? 'RECORDED JEV ASSESSMENT'
                    : 'LIVE JEV ASSESSMENT'
                  : 'SYNTHETIC DEMO'}
              <small>
                {tab !== 'explorer' && benchmark
                  ? benchmark.models.join(', ')
                  : hasJev
                    ? judgment.model
                    : 'No API key needed to explore'}
              </small>
            </div>
          </div>
          <div className="workspace-tabs" role="tablist" aria-label="Laboratory views">
            {(
              [
                { key: 'explorer', icon: GitBranch, label: 'Boundary explorer', n: '01' },
                { key: 'surface', icon: Activity, label: 'Decision surface', n: '02' },
                { key: 'risk', icon: SlidersHorizontal, label: 'Risk appetite', n: '03' },
              ] as const
            ).map(({ key, icon: Icon, label, n }) => (
              <button
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                key={key}
                onClick={() => setTab(key)}
              >
                <span>{n}</span>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <div
            className={`change-notice ${boundary ? 'crossed' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span>{boundary ? <GitBranch size={15} /> : <Circle size={9} />}</span>
            {notice}
          </div>
          {tab === 'explorer' && (
            <div
              className="explorer-grid"
              role="tabpanel"
              id="panel-explorer"
              aria-labelledby="tab-explorer"
            >
              <div className="case-panel panel">
                <div className="panel-bar">
                  <span>
                    <FileText size={14} /> THE CASE FILE
                  </span>
                  <button
                    className="icon-button"
                    title="Reset case"
                    aria-label="Reset case"
                    onClick={() =>
                      update(INITIAL_CASE, 'Case reset to the original disputed cancellation.')
                    }
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div className="case-content">
                  <div className="case-selector">
                    <label htmlFor="case-preset">START WITH A SCENARIO</label>
                    <select
                      id="case-preset"
                      value=""
                      onChange={(e) => selectCase(PRESETS[Number(e.target.value)].case)}
                    >
                      <option value="" disabled>
                        Choose a case file
                      </option>
                      {PRESETS.map((p, i) => (
                        <option key={p.name} value={i}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="case-meta">
                    <span>{flight.id}</span>
                    <span>FICTIONAL / EU261</span>
                  </div>
                  <div className="route">
                    <div>
                      <strong>{flight.originEU ? 'BCN' : 'JFK'}</strong>
                      <span>{flight.origin}</span>
                    </div>
                    <div className="route-line">
                      <span />
                      <Plane size={19} />
                      <span />
                    </div>
                    <div>
                      <strong>{flight.destinationEU ? 'BER' : 'DXB'}</strong>
                      <span>{flight.destination}</span>
                    </div>
                  </div>
                  <p className="case-summary">
                    {flight.event === 'cancellation'
                      ? `Flight cancelled. Passenger notified ${flight.noticeDays} days before departure.`
                      : flight.event === 'delay'
                        ? `Flight delayed. Passenger arrived ${flight.arrivalDelay} minutes late.`
                        : 'Passenger denied boarding. The grounds determine what happens next.'}{' '}
                    {flight.rerouting && flight.event !== 'delay'
                      ? `Replacement departs ${flight.rerouteDepartureEarly} minutes earlier and arrives ${flight.rerouteArrivalDelay} minutes late.`
                      : ''}
                  </p>
                  <div className="evidence-tags">
                    <span>
                      <FileText size={11} />{' '}
                      {flight.evidence === 'complete'
                        ? 'DOCUMENTED'
                        : flight.evidence === 'partial'
                          ? 'PARTIAL RECORD'
                          : 'CONFLICTING RECORD'}
                    </span>
                    <span>SIMULATED EVIDENCE</span>
                  </div>
                  <div className="divider-label">
                    <span>01 / KNOWN FACTS</span>
                    <SlidersHorizontal size={13} />
                  </div>
                  <div className="field">
                    <label htmlFor="event">Disruption type</label>
                    <select
                      id="event"
                      value={flight.event}
                      onChange={(e) => update({ event: e.target.value as FlightCase['event'] })}
                    >
                      <option value="cancellation">Cancellation</option>
                      <option value="delay">Delay</option>
                      <option value="denied_boarding">Denied boarding</option>
                    </select>
                  </div>
                  {flight.event === 'cancellation' && (
                    <Slider
                      label="Cancellation notice"
                      value={flight.noticeDays}
                      max={30}
                      step={0.1}
                      suffix=" days"
                      marks="7d · 14d boundaries"
                      onChange={(n) => update({ noticeDays: n })}
                    />
                  )}
                  {flight.event === 'delay' && (
                    <>
                      <Slider
                        label="Arrival delay"
                        value={flight.arrivalDelay}
                        max={600}
                        suffix=" min"
                        marks="180 min boundary"
                        onChange={(n) => update({ arrivalDelay: n })}
                      />
                      <Slider
                        label="Departure delay"
                        value={flight.departureDelay}
                        max={600}
                        suffix=" min"
                        marks="Used for care, not compensation"
                        onChange={(n) => update({ departureDelay: n })}
                      />
                    </>
                  )}
                  {flight.event === 'denied_boarding' && (
                    <div className="field">
                      <label htmlFor="boarding">Grounds for refusal</label>
                      <select
                        id="boarding"
                        value={flight.boardingReason}
                        onChange={(e) =>
                          update({ boardingReason: e.target.value as FlightCase['boardingReason'] })
                        }
                      >
                        <option value="overbooking">Involuntary overbooking</option>
                        <option value="voluntary">Voluntary surrender</option>
                        <option value="safety">Health / safety / documents</option>
                        <option value="unknown">Unknown / disputed</option>
                      </select>
                    </div>
                  )}
                  <Slider
                    label="Flight distance"
                    value={flight.distanceKm}
                    min={1}
                    max={6000}
                    suffix=" km"
                    marks="1,500 · 3,500 km"
                    onChange={(n) => update({ distanceKm: n })}
                  />
                  {flight.event !== 'delay' && (
                    <>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={flight.rerouting}
                          onChange={(e) => update({ rerouting: e.target.checked })}
                        />{' '}
                        Replacement flight offered
                      </label>
                      {flight.rerouting && (
                        <>
                          <Slider
                            label="Replacement arrives late"
                            value={flight.rerouteArrivalDelay}
                            max={720}
                            suffix=" min"
                            marks="120 · 180 · 240 min"
                            onChange={(n) => update({ rerouteArrivalDelay: n })}
                          />
                          <Slider
                            label="Replacement departs early"
                            value={flight.rerouteDepartureEarly}
                            max={240}
                            suffix=" min"
                            marks="60 · 120 min"
                            onChange={(n) => update({ rerouteDepartureEarly: n })}
                          />
                        </>
                      )}
                    </>
                  )}
                  <details className="more-facts">
                    <summary>
                      Coverage & scope <ChevronDown size={14} />
                    </summary>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={flight.originEU}
                        onChange={(e) =>
                          update({
                            originEU: e.target.checked,
                            origin: e.target.checked ? 'Barcelona' : 'New York',
                          })
                        }
                      />{' '}
                      Departure in EU
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={flight.destinationEU}
                        onChange={(e) =>
                          update({
                            destinationEU: e.target.checked,
                            destination: e.target.checked ? 'Berlin' : 'Dubai',
                          })
                        }
                      />{' '}
                      Arrival in EU
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={flight.euCarrier}
                        onChange={(e) => update({ euCarrier: e.target.checked })}
                      />{' '}
                      EU operating carrier
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={flight.specialCase}
                        onChange={(e) => update({ specialCase: e.target.checked })}
                      />{' '}
                      Scope edge case / connecting itinerary
                    </label>
                    <p className="fine-print">
                      Distance is an independent simulation input. Assumes confirmed reservation and
                      timely check-in; overseas territories and prior non-EU benefits require
                      review.
                    </p>
                  </details>
                  <div className="divider-label">
                    <span>02 / UNCERTAIN FACTS</span>
                    <Sparkles size={13} />
                  </div>
                  <div className="two-fields">
                    <div className="field">
                      <label htmlFor="cause">Reported cause</label>
                      <select
                        id="cause"
                        value={flight.cause}
                        onChange={(e) => {
                          const cause = e.target.value as FlightCase['cause'];
                          update(
                            { cause, narrative: CAUSES[cause].text },
                            'Changed the cause scenario. Demo probabilities come from a fixed fixture.',
                          );
                        }}
                      >
                        {Object.entries(CAUSES).map(([key, c]) => (
                          <option key={key} value={key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="evidence">Evidence</label>
                      <select
                        id="evidence"
                        value={flight.evidence}
                        onChange={(e) =>
                          update({ evidence: e.target.value as FlightCase['evidence'] })
                        }
                      >
                        <option value="complete">Complete</option>
                        <option value="partial">Partial</option>
                        <option value="conflicting">Conflicting</option>
                      </select>
                    </div>
                  </div>
                  <details className="more-facts">
                    <summary>
                      Read / edit the evidence <ChevronDown size={14} />
                    </summary>
                    <label htmlFor="narrative" className="fine-print">
                      Narrative sent to Jev only when you run a live assessment.
                    </label>
                    <textarea
                      id="narrative"
                      rows={5}
                      maxLength={3000}
                      value={flight.narrative}
                      onChange={(e) =>
                        update(
                          { narrative: e.target.value },
                          'Narrative edited. Synthetic fixture judgments do not interpret free text; run Jev to assess this narrative.',
                        )
                      }
                    />
                    <p className="fine-print">
                      Demo judgments use cause and evidence presets; editing text alone changes only
                      the live assessment input.
                    </p>
                  </details>
                  <button className="button boundary-button" onClick={crossBoundary}>
                    <GitBranch size={16} /> Change one fact <ArrowRight size={16} />
                  </button>
                  <p className="button-note">
                    Jump across the nearest timing or boarding boundary.
                  </p>
                </div>
              </div>
              <div className="reasoning-column">
                <div
                  className={`result-panel ${decision.outcome.toLowerCase()} ${boundary ? 'boundary-flash' : ''}`}
                >
                  <div className="result-top">
                    <span>OPERATIONAL DECISION</span>
                    <span>{hasJev ? 'JEV + POLICY' : 'DEMO + POLICY'}</span>
                  </div>
                  <div className="result-heading">
                    <Stamp outcome={decision.outcome} />
                    <div className="amount">
                      <strong>{decision.outcome === 'APPROVE' ? eur(decision.amount) : '—'}</strong>
                      <span>SIMULATED COMPENSATION</span>
                    </div>
                  </div>
                  <p>{decision.reason}</p>
                  <div className="result-footer">
                    <span>
                      <ShieldCheck size={14} /> {pct(decision.confidence)} decision strength
                    </span>
                    <button onClick={() => setReceipt(true)}>
                      Decision receipt <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="panel rule-panel">
                  <div className="panel-bar">
                    <span>
                      <GitBranch size={14} /> THE REASONING TRAIL
                    </span>
                    <span>POLICY v1.0</span>
                  </div>
                  <div className="rule-trail">
                    {decision.rules.map((rule, i) => (
                      <div
                        className={`rule-item ${rule.state} ${rule.id === 'ART. 5(3)' ? 'judgment-rule' : ''}`}
                        key={rule.id}
                      >
                        <div className="rule-marker">
                          <StatusIcon state={rule.state} />
                          {i !== decision.rules.length - 1 && <span />}
                        </div>
                        <div className="rule-body">
                          <div className="rule-heading">
                            <strong>{rule.label}</strong>
                            <a href={rule.source} target="_blank" rel="noreferrer">
                              {rule.id} <ArrowUpRight size={10} />
                            </a>
                          </div>
                          <p>{rule.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="judgment-panel panel">
                  <div className="panel-bar">
                    <span>
                      <Sparkles size={14} /> THE UNCERTAINTY SENSOR
                    </span>
                    <span>{hasJev ? (isRecorded ? 'RECORDED' : 'LIVE') : 'SYNTHETIC'}</span>
                  </div>
                  <div className="judgment-content">
                    <div className="judgment-title">
                      <h3>Was the cause extraordinary?</h3>
                      <strong>
                        {pct(judgment.extraordinaryProbability)}
                        <small>PROBABILITY OF YES</small>
                      </strong>
                    </div>
                    <div className="probability-scale">
                      <div style={{ width: pct(1 - judgment.extraordinaryProbability) }} />
                      <div style={{ width: pct(judgment.extraordinaryProbability) }} />
                    </div>
                    <div className="probability-labels">
                      <span>Ordinary cause</span>
                      <span>Extraordinary cause</span>
                    </div>
                    <p className="fine-print">
                      {hasJev
                        ? `${isRecorded ? 'Recorded Jev assessment. ' : ''}Noul returns a probability, not a separate confidence score.`
                        : 'Illustrative probability from a fixed scenario fixture. This is not a live model prediction.'}
                    </p>
                    <div className="judgment-scores">
                      <div>
                        <span>Evidence</span>
                        <strong>
                          {judgment.evidenceScore.toFixed(1)} <small>/ 3</small>
                        </strong>
                      </div>
                      <div>
                        <span>Cause clarity</span>
                        <strong>
                          {judgment.clarityScore.toFixed(1)} <small>/ 3</small>
                        </strong>
                      </div>
                      <div>
                        <span>Assessment</span>
                        <strong>{hasJev ? 'Jev' : 'Fixture'}</strong>
                      </div>
                    </div>
                    {judgment.distributions && (
                      <div className="score-distributions">
                        {(['evidence', 'clarity'] as const).map((key) => (
                          <div key={key}>
                            <span className="eyebrow">{key} probabilities · 0–3</span>
                            <div>
                              {judgment.distributions![key].map((p, i) => (
                                <span key={i} title={`Level ${i}: ${pct(p)}`}>
                                  <b style={{ height: `${Math.max(2, p * 44)}px` }} />
                                  {i}: {pct(p)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="button jev-button"
                      disabled={loading || !liveAvailable || decision.confidence === 1}
                      onClick={runLive}
                    >
                      <Sparkles size={15} />
                      {loading
                        ? 'Assessing the facts…'
                        : decision.confidence === 1
                          ? 'No Jev needed for this case'
                          : 'Assess with live Jev'}
                      <ArrowUpRight size={14} />
                    </button>
                    {!liveAvailable && (
                      <p className="button-note">
                        Live mode awaits the owner’s API key.{' '}
                        <a href={`${GITHUB}#add-your-jev-api-key`} target="_blank" rel="noreferrer">
                          Setup instructions ↗
                        </a>
                      </p>
                    )}
                  </div>
                </div>
                <div className="counterfactual">
                  <GitBranch size={18} />
                  <div>
                    <h4>What would change this result?</h4>
                    <p>{decision.counterfactual}</p>
                  </div>
                </div>
                <details className="care-note">
                  <summary>
                    What about care & assistance? <ChevronDown size={13} />
                  </summary>
                  <p>{decision.assistance}</p>
                  <a href={GUIDANCE} target="_blank" rel="noreferrer">
                    Official passenger-rights guidance ↗
                  </a>
                </details>
              </div>
            </div>
          )}
          {tab === 'surface' && (
            <div
              role="tabpanel"
              id="panel-surface"
              aria-labelledby="tab-surface"
              className="surface-panel panel"
            >
              <div className="panel-bar">
                <span>
                  <Activity size={14} /> THE DECISION SURFACE
                </span>
                <button
                  onClick={() =>
                    saveFile('exception-engine-600-cases.json', {
                      syntheticCases: true,
                      judgmentSource: benchmark ? 'recorded-jev' : 'synthetic-fixtures',
                      benchmarkCompletedAt: benchmark?.completedAt,
                      models: benchmark?.models,
                      seed: 2612004,
                      count: BENCHMARK.length,
                      thresholds,
                      cases: stats.results,
                    })
                  }
                >
                  <Download size={14} /> Export 600 cases
                </button>
              </div>
              <div className="surface-intro">
                <div>
                  <h3>
                    Every dot is a case.
                    <br />
                    Every colour is a consequence.
                  </h3>
                  <p>
                    {benchmark
                      ? '600 synthetic scenarios assessed by Jev.'
                      : 'Explore 600 reproducible synthetic scenarios.'}
                    <br />
                    {benchmark
                      ? `Recorded ${new Date(benchmark.completedAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })} · ${benchmark.models.join(', ')} · no repeat API calls.`
                      : 'Select a point or open a case in the table below.'}
                  </p>
                </div>
                <div className="chart-legend">
                  {(['APPROVE', 'DENY', 'REVIEW'] as const).map((o) => (
                    <span key={o}>
                      <i className={o.toLowerCase()} />
                      {LABELS[o]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="scatter-wrap">
                <svg
                  className="scatter"
                  viewBox="0 0 900 370"
                  role="img"
                  aria-label={`Decision surface: ${stats.approve} approvals, ${stats.deny} denials, ${stats.review} reviews. Use the searchable case table for keyboard access.`}
                >
                  <rect x="65" y="15" width="810" height="300" fill="#f6f5ef" />
                  {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                    <g key={v}>
                      <line
                        x1="65"
                        x2="875"
                        y1={315 - v * 300}
                        y2={315 - v * 300}
                        stroke="#dcded6"
                        strokeDasharray="3 5"
                      />
                      <text x="52" y={319 - v * 300} textAnchor="end">
                        {pct(v)}
                      </text>
                      <text x={65 + v * 810} y="337" textAnchor="middle">
                        {pct(v)}
                      </text>
                    </g>
                  ))}
                  {stats.results.map((r, i) => {
                    const strength =
                      r.decision.confidence === 1
                        ? r.decision.eligible
                          ? 0.98
                          : 0.02
                        : 1 - r.judgment.extraordinaryProbability;
                    const jitter = (((i * 7919) % 37) / 37 - 0.5) * 16;
                    return (
                      <circle
                        key={r.case.id}
                        cx={65 + strength * 810 + jitter}
                        cy={315 - r.decision.confidence * 285 + jitter * 0.45}
                        r="4"
                        className={`data-dot ${r.decision.outcome.toLowerCase()}`}
                        onClick={() => selectCase(r.case)}
                      >
                        <title>
                          {r.case.id}: {LABELS[r.decision.outcome]}. Click to inspect.
                        </title>
                      </circle>
                    );
                  })}
                  <text x="470" y="365" textAnchor="middle">
                    ESTIMATED SUPPORT FOR COMPENSATION →
                  </text>
                  <text transform="translate(15 170) rotate(-90)" textAnchor="middle">
                    JUDGMENT STRENGTH →
                  </text>
                </svg>
              </div>
              <p className="chart-caption">
                Colour comes from the full policy evaluation. Positions are illustrative; repeated
                points are offset slightly for visibility. Unknown labels are preserved.
              </p>
              <div className="surface-stats">
                <div>
                  <strong>{stats.approve}</strong>
                  <span>Auto approve</span>
                </div>
                <div>
                  <strong>{stats.deny}</strong>
                  <span>Auto deny</span>
                </div>
                <div>
                  <strong>{stats.review}</strong>
                  <span>Human review</span>
                </div>
                <div>
                  <strong>{stats.unlabeled}</strong>
                  <span>Intentionally unlabeled</span>
                </div>
              </div>
              <div className="table-tools">
                <div className="field">
                  <label htmlFor="case-search">Search cases</label>
                  <input
                    id="case-search"
                    type="search"
                    placeholder="Case ID, route, or cause…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="outcome-filter">Decision</label>
                  <select
                    id="outcome-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All decisions</option>
                    {(['APPROVE', 'DENY', 'REVIEW'] as const).map((o) => (
                      <option key={o} value={o}>
                        {LABELS[o]}
                      </option>
                    ))}
                  </select>
                </div>
                <span>{visibleCases.length} matching cases</span>
              </div>
              <div className="case-table">
                <table>
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Disruption</th>
                      <th>Cause</th>
                      <th>Decision</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCases.slice(0, 25).map((r) => (
                      <tr key={r.case.id}>
                        <td className="mono">{r.case.id}</td>
                        <td>{r.case.event.replace('_', ' ')}</td>
                        <td>{CAUSES[r.case.cause].label}</td>
                        <td>
                          <span className={`outcome-tag ${r.decision.outcome.toLowerCase()}`}>
                            {LABELS[r.decision.outcome]}
                          </span>
                        </td>
                        <td>
                          <button
                            aria-label={`Inspect ${r.case.id}`}
                            onClick={() => selectCase(r.case)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleCases.length === 0 && (
                  <p className="empty-state">
                    No cases match. Try another search or decision filter.
                  </p>
                )}
              </div>
              <p className="chart-caption">
                Showing the first 25 matches. Search by case ID to inspect any of the 600 records.
              </p>
            </div>
          )}
          {tab === 'risk' && (
            <div role="tabpanel" id="panel-risk" aria-labelledby="tab-risk" className="risk-grid">
              <div className="panel">
                <div className="panel-bar">
                  <span>
                    <Scale size={14} /> SET THE RISK APPETITE
                  </span>
                </div>
                <div className="risk-controls">
                  <h3>
                    How certain is
                    <br />
                    certain enough?
                  </h3>
                  <p>
                    A mistaken denial can cost more than a mistaken approval. Set separate
                    thresholds.
                  </p>
                  <Slider
                    label="Approval confidence"
                    value={Math.round(thresholds.approve * 100)}
                    min={50}
                    max={100}
                    suffix="%"
                    onChange={(n) => setThresholds((t) => ({ ...t, approve: n / 100 }))}
                  />
                  <Slider
                    label="Denial confidence"
                    value={Math.round(thresholds.deny * 100)}
                    min={50}
                    max={100}
                    suffix="%"
                    onChange={(n) => setThresholds((t) => ({ ...t, deny: n / 100 }))}
                  />
                  <div className="divider-label">
                    <span>YOUR COST ASSUMPTIONS</span>
                    <Scale size={13} />
                  </div>
                  {(
                    [
                      { key: 'falseApproval', label: 'Wrongful approval', max: 2000 },
                      { key: 'falseDenial', label: 'Wrongful denial', max: 5000 },
                      { key: 'review', label: 'Human review', max: 100 },
                    ] as const
                  ).map((c) => (
                    <Slider
                      key={c.key}
                      label={c.label}
                      value={costs[c.key]}
                      min={c.key === 'review' ? 5 : 50}
                      max={c.max}
                      step={c.key === 'review' ? 5 : 50}
                      suffix=" EUR"
                      onChange={(n) => setCosts((v) => ({ ...v, [c.key]: n }))}
                    />
                  ))}
                  <button
                    className="button secondary"
                    onClick={() => {
                      setThresholds(DEFAULT_THRESHOLDS);
                      setCosts({ falseApproval: 400, falseDenial: 1200, review: 25 });
                    }}
                  >
                    Reset assumptions <RotateCcw size={14} />
                  </button>
                </div>
              </div>
              <div className="risk-results">
                <div className="risk-metrics">
                  <div>
                    <span>AUTOMATION RATE</span>
                    <strong>{pct(stats.automation)}</strong>
                    <small>{stats.approve + stats.deny} of 600 cases</small>
                  </div>
                  <div>
                    <span>MODELED TOTAL LOSS</span>
                    <strong>{eur(stats.expectedLoss)}</strong>
                    <small>Review cost + expected mistakes</small>
                  </div>
                  <div>
                    <span>HUMAN REVIEW</span>
                    <strong>{stats.review}</strong>
                    <small>{pct(stats.review / 600)} of the benchmark</small>
                  </div>
                </div>
                <div className="panel frontier-panel">
                  <div className="panel-bar">
                    <span>
                      <Activity size={14} /> THE AUTOMATION FRONTIER
                    </span>
                    <span>11 POLICIES</span>
                  </div>
                  <div className="frontier-content">
                    <h3>More automation has a price.</h3>
                    <p>Each point is a threshold pair. Select one to apply it.</p>
                    <svg
                      viewBox="0 0 560 290"
                      className="frontier-chart"
                      role="img"
                      aria-label="Automation rate versus modeled expected loss. Use the policy buttons below to select thresholds."
                    >
                      {[0, 0.5, 1].map((v) => (
                        <g key={v}>
                          <line
                            x1="65"
                            x2="535"
                            y1={230 - v * 200}
                            y2={230 - v * 200}
                            stroke="#dcded6"
                            strokeDasharray="3 5"
                          />
                          <text x="56" y={234 - v * 200} textAnchor="end">
                            {eur(v * Math.max(...policies.map((p) => p.expectedLoss)) * 1.1)}
                          </text>
                          <text x={65 + v * 470} y="253" textAnchor="middle">
                            {pct(v)}
                          </text>
                        </g>
                      ))}
                      <polyline
                        fill="none"
                        stroke="#476c5b"
                        strokeWidth="2"
                        points={policies
                          .map(
                            (p) =>
                              `${65 + p.automation * 470},${230 - (p.expectedLoss / (Math.max(...policies.map((q) => q.expectedLoss)) * 1.1)) * 200}`,
                          )
                          .join(' ')}
                      />
                      {policies.map((p, i) => (
                        <circle
                          key={i}
                          cx={65 + p.automation * 470}
                          cy={
                            230 -
                            (p.expectedLoss /
                              (Math.max(...policies.map((q) => q.expectedLoss)) * 1.1)) *
                              200
                          }
                          r={p === optimal ? 7 : 5}
                          fill={p === optimal ? '#b08235' : '#476c5b'}
                          stroke="#fff"
                          strokeWidth="2"
                          onClick={() => setThresholds(p.thresholds)}
                          className="frontier-dot"
                        >
                          <title>
                            Approve {pct(p.thresholds.approve)}, deny {pct(p.thresholds.deny)}:{' '}
                            {pct(p.automation)} automated; loss {eur(p.expectedLoss)}
                          </title>
                        </circle>
                      ))}
                      <text x="300" y="280" textAnchor="middle">
                        CASES AUTOMATED →
                      </text>
                    </svg>
                    <div className="policy-buttons">
                      {policies.map((p, i) => (
                        <button
                          key={i}
                          className={
                            thresholds.approve === p.thresholds.approve &&
                            thresholds.deny === p.thresholds.deny
                              ? 'active'
                              : ''
                          }
                          onClick={() => setThresholds(p.thresholds)}
                          title={`Approval / denial thresholds. Expected loss ${eur(p.expectedLoss)}`}
                        >
                          {pct(p.thresholds.approve)} / {pct(p.thresholds.deny)}
                        </button>
                      ))}
                    </div>
                    <div className="optimal">
                      <Sparkles size={18} />
                      <div>
                        <strong>Lowest modeled loss among these 11 policies</strong>
                        <p>
                          {pct(optimal.thresholds.approve)} approval ·{' '}
                          {pct(optimal.thresholds.deny)} denial · {eur(optimal.expectedLoss)} total
                        </p>
                      </div>
                      <button onClick={() => setThresholds(optimal.thresholds)}>
                        Apply <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="assumptions">
                  <h4>Read the assumptions, not just the chart.</h4>
                  <p>
                    Expected loss = review count × review cost + each labeled automated case’s (1 −
                    decision strength) × its mistake cost. Processing cost is set to €0.{' '}
                    {benchmark
                      ? 'Probabilities come from 600 recorded Jev assessments; decision strength remains a heuristic, not calibrated error probability.'
                      : 'These probabilities are hand-authored fixtures, not calibrated Jev performance.'}
                  </p>
                  <p>
                    {stats.errors} disagreements across {stats.labeledAutomated} automated, labeled
                    cases in this synthetic benchmark. Labels share policy code with the engine;
                    this is a comparison against controlled synthetic labels, not independent legal
                    accuracy evidence. {stats.unlabeled} cases remain unlabeled and are excluded
                    from error calculations. Evidence and clarity below 2/3 always require review.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="lab-footnote">
            <AlertTriangle size={13} />
            <span>
              Experimental / educational decision-system simulation. Fictional cases. A bounded
              EU261 model, not legal advice or real claim eligibility.
            </span>
          </div>
        </section>
        <section id="methodology" className="methodology wrap">
          <div className="method-heading">
            <span className="eyebrow">THE THINKING BEHIND THE ENGINE</span>
            <h2>
              The rule is deterministic.
              <br />
              <em>The fact isn’t.</em>
            </h2>
            <p>
              Most policies are written as rules. Most operations teams spend their time dealing
              with exceptions. This experiment separates what software can calculate from what it
              needs help understanding.
            </p>
            <a href={`${GITHUB}/blob/main/docs/methodology.md`} target="_blank" rel="noreferrer">
              Read the methodology <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="method-steps">
            <article>
              <span>01 / FACTS</span>
              <h3>Start with what’s known.</h3>
              <p>Routes, notice periods, and arrival times are structured inputs. No AI needed.</p>
            </article>
            <ArrowDown size={17} />
            <article>
              <span>02 / JUDGMENT</span>
              <h3>Ask a smaller question.</h3>
              <p>
                Jev assesses cause, evidence, and clarity. It never decides whether to pay a claim.
                The 600-case benchmark uses recorded Jev assessments; edited cases can use synthetic
                fixtures or a fresh live assessment.
              </p>
            </article>
            <ArrowDown size={17} />
            <article>
              <span>03 / CONSEQUENCE</span>
              <h3>Let code apply the policy.</h3>
              <p>
                Source-linked rules calculate the consequence. Separate confidence gates determine
                whether to automate or ask a human.
              </p>
            </article>
          </div>
        </section>
        <section className="source-strip wrap">
          <div>
            <ShieldCheck size={18} />
            <div>
              <strong>Grounded in sources. Open to inspection.</strong>
              <p>
                EU261 lab v1.0 · 600 synthetic cases ·{' '}
                {benchmark ? `${benchmark.models.join(', ')} recorded judgments` : 'Seed 2612004'} ·
                Max 700 records
              </p>
            </div>
          </div>
          <a href={REGULATION} target="_blank" rel="noreferrer">
            Regulation 261/2004 <ExternalLink size={13} />
          </a>
          <a href={GUIDANCE} target="_blank" rel="noreferrer">
            Official guidance <ExternalLink size={13} />
          </a>
        </section>
      </main>
      <footer className="site-footer wrap">
        <div>
          <a className="footer-name" href="https://ankitkapoor.me" target="_blank" rel="noreferrer">
            An experiment by Ankit Kapoor <ArrowUpRight size={14} />
          </a>
          <p>Building systems that know when they don’t know enough.</p>
        </div>
        <a href={GITHUB} target="_blank" rel="noreferrer">
          Explore the source <ArrowUpRight size={15} />
        </a>
        <span>POLICY × PROBABILITY × PEOPLE</span>
      </footer>
      <dialog
        ref={dialog}
        className="receipt-dialog"
        onCancel={() => setReceipt(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setReceipt(false);
        }}
      >
        <div className="receipt-document">
          <div className="receipt-actions">
            <span>DECISION RECEIPT</span>
            <button aria-label="Close decision receipt" onClick={() => setReceipt(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="eyebrow">THE EXCEPTION ENGINE / AUDIT COPY</div>
          <h2>{flight.id}</h2>
          <Stamp outcome={decision.outcome} />
          <p>
            {flight.origin} → {flight.destination} · {flight.event.replace('_', ' ')}
          </p>
          <dl>
            <div>
              <dt>Compensation</dt>
              <dd>
                {decision.outcome === 'APPROVE'
                  ? eur(decision.amount)
                  : 'Not awarded / undetermined'}
              </dd>
            </div>
            <div>
              <dt>Decision strength</dt>
              <dd>{pct(decision.confidence)}</dd>
            </div>
            <div>
              <dt>Thresholds (approve / deny)</dt>
              <dd>
                {pct(thresholds.approve)} / {pct(thresholds.deny)}
              </dd>
            </div>
            <div>
              <dt>Policy / question version</dt>
              <dd>
                {decision.policyVersion} / {judgment.questionVersion}
              </dd>
            </div>
            <div>
              <dt>Assessment model</dt>
              <dd>
                {judgment.model} ({judgment.mode})
              </dd>
            </div>
            <div>
              <dt>Judgment timestamp</dt>
              <dd>{judgment.timestamp}</dd>
            </div>
            <div>
              <dt>Receipt timestamp</dt>
              <dd>{receiptTime}</dd>
            </div>
            <div>
              <dt>Extraordinary probability</dt>
              <dd>{pct(judgment.extraordinaryProbability)}</dd>
            </div>
            <div>
              <dt>Evidence / clarity</dt>
              <dd>
                {judgment.evidenceScore.toFixed(1)} / {judgment.clarityScore.toFixed(1)} of 3
              </dd>
            </div>
          </dl>
          <h3>Known facts</h3>
          <p>
            {flight.distanceKm} km · Arrival delay {flight.arrivalDelay} min · Departure delay{' '}
            {flight.departureDelay} min · Notice {flight.noticeDays} days · Rerouting{' '}
            {flight.rerouting
              ? `${flight.rerouteDepartureEarly} min early / ${flight.rerouteArrivalDelay} min late`
              : 'not offered'}
          </p>
          <h3>Evidence</h3>
          <p>{flight.narrative}</p>
          <h3>Rules applied</h3>
          {decision.rules.map((r) => (
            <p key={r.id}>
              <a href={r.source} target="_blank" rel="noreferrer">
                {r.id}
              </a>{' '}
              · {r.label}: {r.detail}
            </p>
          ))}
          <h3>What would change the result?</h3>
          <p>{decision.counterfactual}</p>
          <h3>Care & assistance</h3>
          <p>{decision.assistance}</p>
          <p className="fine-print">
            Educational simulation. This receipt is not a legal determination. The complete JSON
            includes the case snapshot and probability distributions when provided.
          </p>
          <div className="receipt-bottom">
            <button
              className="button primary"
              onClick={() => saveFile(`${flight.id}-receipt.json`, receiptData(receiptTime))}
            >
              <Download size={15} /> Download full receipt
            </button>
            <button className="button secondary" onClick={() => window.print()}>
              Print / save PDF
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
