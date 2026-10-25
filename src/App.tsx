import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  Download,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Check,
  X,
  CircleHelp,
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  Fingerprint,
  Scale,
  Activity,
  AlertTriangle,
  Megaphone,
  Ticket,
  Luggage,
  Printer,
  Radar,
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
  type FlightCase,
  type Judgment,
  type Outcome,
  type Thresholds,
} from './lib/types';
import { Barcode, Count, SplitFlap, useReducedMotion, useReveal } from './ui';

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
const BOARD: Record<Outcome, string> = {
  APPROVE: 'AUTO APPROVE',
  DENY: 'AUTO DENY',
  REVIEW: 'SEE AGENT',
};
const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';
const fromCode = (c: FlightCase) => (c.originEU ? 'BCN' : 'JFK');
const toCode = (c: FlightCase) => (c.destinationEU ? 'BER' : 'DXB');
const flightNo = (id: string) => id.replace('EE-DEMO-', 'EE D').replace('EE-', 'EE ');
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
    <Check size={14} />
  ) : state === 'fail' ? (
    <X size={14} />
  ) : (
    <CircleHelp size={14} />
  );
}
function Gauge({ value }: { value: number }) {
  return (
    <svg className="gauge" viewBox="0 0 200 112" aria-hidden="true">
      <defs>
        <linearGradient id="gauge-arc" x1="0" x2="1">
          <stop offset="0" stopColor="var(--approve)" />
          <stop offset="0.5" stopColor="var(--review)" />
          <stop offset="1" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <path d="M16 100 A84 84 0 0 1 184 100" className="gauge-track" />
      <path d="M16 100 A84 84 0 0 1 184 100" className="gauge-arc" />
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI - (i / 10) * Math.PI;
        return (
          <line
            key={i}
            x1={100 + Math.cos(a) * 70}
            y1={100 - Math.sin(a) * 70}
            x2={100 + Math.cos(a) * (i % 5 ? 64 : 58)}
            y2={100 - Math.sin(a) * (i % 5 ? 64 : 58)}
            className="gauge-tick"
          />
        );
      })}
      <g className="gauge-needle" style={{ transform: `rotate(${value * 180 - 90}deg)` }}>
        <path d="M100 26 L104 100 L96 100 Z" />
      </g>
      <circle cx="100" cy="100" r="7" className="gauge-hub" />
    </svg>
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
  const reducedMotion = useReducedMotion();
  const heroPass = useRef<HTMLDivElement>(null);
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = heroPass.current;
    if (!el || e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    el.style.setProperty('--ry', `${((e.clientX - box.left) / box.width - 0.5) * 10}deg`);
    el.style.setProperty('--rx', `${((e.clientY - box.top) / box.height - 0.5) * -8}deg`);
  };
  const untilt = () => {
    heroPass.current?.style.setProperty('--ry', '0deg');
    heroPass.current?.style.setProperty('--rx', '0deg');
  };
  const sequenceRef = useReveal<HTMLDivElement>();
  const methodRef = useReveal<HTMLElement>();
  const sourceRef = useReveal<HTMLElement>();
  const footerRef = useReveal<HTMLElement>();
  const ticker = stats.results.slice(0, 18);
  const maxLoss = Math.max(...policies.map((p) => p.expectedLoss)) * 1.1;

  return (
    <>
      <a href="#laboratory" className="skip-link">
        Skip to the laboratory
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#">
            <span className="brand-symbol" aria-hidden="true">
              <Plane size={18} />
            </span>
            <span className="brand-name">
              THE EXCEPTION ENGINE
              <small>Flight EE 261 · Policy Air</small>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#laboratory" onClick={() => setTab('explorer')}>
              <span>Gate A</span> The laboratory
            </a>
            <a href="#methodology">
              <span>Gate B</span> How it works
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="github-link">
              View source <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-label">
            <PlaneTakeoff size={14} /> DEPARTURES
          </div>
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div className="ticker-run" key={copy}>
                {ticker.map((r) => (
                  <span key={r.case.id}>
                    <b>{flightNo(r.case.id)}</b>
                    {fromCode(r.case)} → {toCode(r.case)}
                    <i>{r.case.event.replace('_', ' ')}</i>
                    <em className={r.decision.outcome.toLowerCase()}>
                      {BOARD[r.decision.outcome]}
                    </em>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> NOW BOARDING · A LABORATORY FOR THE GREY AREAS
            </div>
            <h1>
              <span className="line">
                <span>Rules are easy.</span>
              </span>
              <span className="line">
                <span>
                  <em>
                    Exceptions
                    <svg className="scribble" viewBox="0 0 300 90" aria-hidden="true">
                      <path d="M18 52 C 40 12, 250 6, 284 40 C 300 62, 210 86, 120 82 C 50 80, 6 66, 22 40 C 34 22, 90 16, 150 14" />
                    </svg>
                  </em>
                </span>
              </span>
              <span className="line">
                <span>are expensive.</span>
              </span>
            </h1>
            <p>
              Software knows the rules. AI interprets the uncertainty.
              <br className="desktop" /> But who knows when to ask a human?
            </p>
            <div className="hero-actions">
              <a href="#laboratory" className="button primary" onClick={() => setTab('explorer')}>
                <Ticket size={17} /> Board the laboratory <ArrowRight size={17} />
              </a>
              <a href="#methodology" className="button ghost">
                How it works
              </a>
            </div>
            <span className="hero-caption">
              <Luggage size={13} /> EU air passenger rights · 600 recorded cases · A working
              experiment
            </span>
          </div>
          <div
            className="hero-visual"
            onPointerMove={tilt}
            onPointerLeave={untilt}
            aria-label="A boarding pass for case EE-0001: a Barcelona to Berlin cancellation. Two rules pass, the extraordinary-cause question is uncertain at 37%, so the case is stamped for human review."
            role="img"
          >
            <svg
              className="sky-route"
              viewBox="0 0 600 520"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              <path
                id="sky-path"
                className="sky-path"
                d="M-30 470 C 110 300, 260 520, 380 300 S 540 40, 640 20"
              />
              {!reducedMotion && (
                <g className="sky-plane">
                  <path transform="rotate(45) translate(-12 -12)" d={PLANE_PATH} />
                  <animateMotion dur="14s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#sky-path" />
                  </animateMotion>
                </g>
              )}
            </svg>
            <div className="printer-slot" aria-hidden="true" />
            <div className="hero-pass-wrap">
              <div className="hero-pass" ref={heroPass}>
                <div className="pass-main">
                  <div className="pass-head">
                    <span>
                      <Plane size={14} /> EXCEPTION AIR
                    </span>
                    <span>BOARDING PASS</span>
                  </div>
                  <div className="pass-route">
                    <div>
                      <small>FROM</small>
                      <strong>BCN</strong>
                      <span>Barcelona</span>
                    </div>
                    <div className="pass-path">
                      <span className="pass-dash" />
                      <Plane size={18} />
                      <span className="pass-dash" />
                    </div>
                    <div>
                      <small>TO</small>
                      <strong>BER</strong>
                      <span>Berlin</span>
                    </div>
                  </div>
                  <div className="pass-fields">
                    <div>
                      <small>PASSENGER</small>
                      <b>THE GREY AREA</b>
                    </div>
                    <div>
                      <small>FLIGHT</small>
                      <b>EE 0001</b>
                    </div>
                    <div>
                      <small>GATE</small>
                      <b>H1</b>
                    </div>
                    <div>
                      <small>SEAT</small>
                      <b>37%</b>
                    </div>
                  </div>
                  <ul className="pass-checks">
                    <li>
                      <Check size={13} /> Journey covered <span>ART. 3</span>
                    </li>
                    <li>
                      <Check size={13} /> Notice rule checked <span>ART. 5</span>
                    </li>
                    <li className="uncertain">
                      <CircleHelp size={13} /> Extraordinary cause? <span>37% YES</span>
                    </li>
                  </ul>
                </div>
                <div className="pass-stub">
                  <small>CLASS</small>
                  <b>HUMAN</b>
                  <small>BOARDING</small>
                  <b>WHEN UNSURE</b>
                  <Barcode value="EE-0001" />
                  <span className="stub-code">EE0001 · H1</span>
                </div>
              </div>
              <div className="hero-stamp">
                <Stamp outcome="REVIEW" />
              </div>
            </div>
            <div className="margin-note" aria-hidden="true">
              <span>↙</span> This is where
              <br />
              judgment begins.
            </div>
          </div>
        </section>
        <div className="sequence wrap reveal" ref={sequenceRef}>
          {(
            [
              {
                n: 'ZONE 1',
                step: 'Check-in',
                title: 'Policy stays in code.',
                text: 'Explicit rules. Inspectable consequences.',
                icon: GitBranch,
              },
              {
                n: 'ZONE 2',
                step: 'Security',
                title: 'AI assesses the facts.',
                text: 'Bounded questions. Visible uncertainty.',
                icon: Sparkles,
              },
              {
                n: 'ZONE 3',
                step: 'Gate',
                title: 'People handle the grey.',
                text: 'Confidence decides when to escalate.',
                icon: Fingerprint,
              },
            ] as const
          ).map(({ n, step, title, text, icon: Icon }, i) => (
            <div key={n} style={{ '--i': i } as React.CSSProperties}>
              <span className="zone">{n}</span>
              <span className="zone-icon">
                <Icon size={20} />
              </span>
              <p>
                <small>{step}</small>
                <strong>{title}</strong>
                {text}
              </p>
            </div>
          ))}
        </div>

        <section id="laboratory" className="laboratory wrap">
          <div className="section-intro">
            <div>
              <div className="eyebrow">
                <span className="gate-chip">GATE A</span> THE INTERACTIVE LABORATORY
              </div>
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
                <span className="tab-gate">GATE {n}</span>
                <span className="tab-label">
                  <Icon size={16} />
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div
            className={`change-notice ${boundary ? 'crossed' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span className="notice-icon">
              {boundary ? <GitBranch size={15} /> : <Megaphone size={15} />}
            </span>
            <span className="notice-text" key={notice}>
              {notice}
            </span>
          </div>
          {tab === 'explorer' && (
            <div
              className="explorer-grid tab-panel"
              role="tabpanel"
              id="panel-explorer"
              aria-labelledby="tab-explorer"
            >
              <div className="case-panel ticket">
                <div className="ticket-band">
                  <span>
                    <Ticket size={15} /> BOARDING PASS · CASE FILE
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
                  <div className="route">
                    <div>
                      <small>FROM</small>
                      <strong>{fromCode(flight)}</strong>
                      <span>{flight.origin}</span>
                    </div>
                    <div className="route-line" key={flight.id}>
                      <span />
                      <Plane size={20} />
                      <span />
                    </div>
                    <div>
                      <small>TO</small>
                      <strong>{toCode(flight)}</strong>
                      <span>{flight.destination}</span>
                    </div>
                  </div>
                  <div className="ticket-fields">
                    <div>
                      <small>FLIGHT</small>
                      <b>{flight.id}</b>
                    </div>
                    <div>
                      <small>EVENT</small>
                      <b>{flight.event.replace('_', ' ')}</b>
                    </div>
                    <div>
                      <small>DISTANCE</small>
                      <b>{flight.distanceKm.toLocaleString()} km</b>
                    </div>
                    <div>
                      <small>EVIDENCE</small>
                      <b>
                        {flight.evidence === 'complete'
                          ? 'Documented'
                          : flight.evidence === 'partial'
                            ? 'Partial'
                            : 'Conflicting'}
                      </b>
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
                    <span>FICTIONAL / EU261</span>
                    <span>SIMULATED EVIDENCE</span>
                  </div>
                </div>
                <div className="perforation" aria-hidden="true" />
                <div className="case-content">
                  <div className="divider-label">
                    <span>01 / KNOWN FACTS</span>
                    <SlidersHorizontal size={14} />
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
                      Coverage & scope <ChevronDown size={15} />
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
                    <Sparkles size={14} />
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
                      Read / edit the evidence <ChevronDown size={15} />
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
                    <span>
                      <span className="lamp" /> OPERATIONAL DECISION
                    </span>
                    <span>{hasJev ? 'JEV + POLICY' : 'DEMO + POLICY'}</span>
                  </div>
                  <div className="board-grid">
                    <div className="board-cell">
                      <small>FLIGHT</small>
                      <SplitFlap text={flightNo(flight.id)} />
                    </div>
                    <div className="board-cell">
                      <small>ROUTE</small>
                      <SplitFlap text={`${fromCode(flight)} ${toCode(flight)}`} />
                    </div>
                    <div className="board-cell status-cell">
                      <small>STATUS</small>
                      <SplitFlap text={BOARD[decision.outcome]} pad={12} className="status" />
                    </div>
                  </div>
                  <div className="result-heading">
                    <Stamp outcome={decision.outcome} key={decision.outcome} />
                    <div className="amount">
                      <strong>
                        {decision.outcome === 'APPROVE' ? (
                          <Count value={decision.amount} format={eur} duration={600} />
                        ) : (
                          '—'
                        )}
                      </strong>
                      <span>SIMULATED COMPENSATION</span>
                    </div>
                  </div>
                  <p>{decision.reason}</p>
                  <div className="result-footer">
                    <span className="strength">
                      <ShieldCheck size={14} /> {pct(decision.confidence)} decision strength
                      <i style={{ width: pct(decision.confidence) }} />
                    </span>
                    <button onClick={() => setReceipt(true)}>
                      <Ticket size={14} /> Decision receipt <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="panel rule-panel">
                  <div className="panel-bar">
                    <span>
                      <GitBranch size={14} /> THE FLIGHT PATH · REASONING TRAIL
                    </span>
                    <span>POLICY v1.0</span>
                  </div>
                  <div className="rule-trail" key={decision.outcome}>
                    {decision.rules.map((rule, i) => (
                      <div
                        className={`rule-item ${rule.state} ${rule.id === 'ART. 5(3)' ? 'judgment-rule' : ''}`}
                        key={rule.id}
                        style={{ '--i': i } as React.CSSProperties}
                      >
                        <div className="rule-marker">
                          <StatusIcon state={rule.state} />
                          {i !== decision.rules.length - 1 && <span />}
                        </div>
                        <div className="rule-body">
                          <div className="rule-heading">
                            <strong>{rule.label}</strong>
                            <a href={rule.source} target="_blank" rel="noreferrer">
                              {rule.id} <ArrowUpRight size={11} />
                            </a>
                          </div>
                          <p>{rule.detail}</p>
                        </div>
                      </div>
                    ))}
                    <div className="trail-end">
                      <PlaneLanding size={15} /> {LABELS[decision.outcome]}
                    </div>
                  </div>
                </div>
                <div className="judgment-panel panel">
                  <div className="panel-bar">
                    <span>
                      <Radar size={14} /> THE UNCERTAINTY SENSOR
                    </span>
                    <span>{hasJev ? (isRecorded ? 'RECORDED' : 'LIVE') : 'SYNTHETIC'}</span>
                  </div>
                  <div className="judgment-content">
                    <div className="judgment-title">
                      <h3>Was the cause extraordinary?</h3>
                      <div className="gauge-wrap">
                        <Gauge value={judgment.extraordinaryProbability} />
                        <strong>
                          <Count
                            value={judgment.extraordinaryProbability}
                            format={pct}
                            duration={600}
                          />
                          <small>PROBABILITY OF YES</small>
                        </strong>
                      </div>
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
                      className={`button jev-button ${loading ? 'is-loading' : ''}`}
                      disabled={loading || !liveAvailable || decision.confidence === 1}
                      onClick={runLive}
                    >
                      {loading ? <Radar size={15} className="spin" /> : <Sparkles size={15} />}
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
                  <span className="counterfactual-icon">
                    <GitBranch size={18} />
                  </span>
                  <div>
                    <h4>Alternate route: what would change this result?</h4>
                    <p>{decision.counterfactual}</p>
                  </div>
                </div>
                <details className="care-note">
                  <summary>
                    What about care & assistance? <ChevronDown size={14} />
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
              className="surface-panel panel tab-panel"
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
                    <em>Every colour is a consequence.</em>
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
                  <rect x="65" y="15" width="810" height="300" className="scatter-bg" />
                  {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                    <g key={v}>
                      <line
                        x1="65"
                        x2="875"
                        y1={315 - v * 300}
                        y2={315 - v * 300}
                        className="grid-line"
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
                        style={{ animationDelay: `${(i % 120) * 6 + Math.floor(i / 120) * 40}ms` }}
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
                <div className="approve">
                  <strong>
                    <Count value={stats.approve} />
                  </strong>
                  <span>Auto approve</span>
                </div>
                <div className="deny">
                  <strong>
                    <Count value={stats.deny} />
                  </strong>
                  <span>Auto deny</span>
                </div>
                <div className="review">
                  <strong>
                    <Count value={stats.review} />
                  </strong>
                  <span>Human review</span>
                </div>
                <div>
                  <strong>
                    <Count value={stats.unlabeled} />
                  </strong>
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
                <div className="board-title" aria-hidden="true">
                  <PlaneTakeoff size={16} /> DEPARTURES · CASE BOARD
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Route</th>
                      <th>Disruption</th>
                      <th>Cause</th>
                      <th>Decision</th>
                      <th>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCases.slice(0, 25).map((r, i) => (
                      <tr key={r.case.id} style={{ '--i': i } as React.CSSProperties}>
                        <td className="mono">{r.case.id}</td>
                        <td className="mono">
                          {fromCode(r.case)} → {toCode(r.case)}
                        </td>
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
            <div
              role="tabpanel"
              id="panel-risk"
              aria-labelledby="tab-risk"
              className="risk-grid tab-panel"
            >
              <div className="panel">
                <div className="panel-bar">
                  <span>
                    <Scale size={14} /> FLIGHT CONTROLS · RISK APPETITE
                  </span>
                </div>
                <div className="risk-controls">
                  <h3>
                    How certain is
                    <br />
                    <em>certain enough?</em>
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
                    <Scale size={14} />
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
                    <strong>
                      <Count value={stats.automation} format={pct} />
                    </strong>
                    <small>{stats.approve + stats.deny} of 600 cases</small>
                    <i className="meter">
                      <b style={{ width: pct(stats.automation) }} />
                    </i>
                  </div>
                  <div>
                    <span>MODELED TOTAL LOSS</span>
                    <strong>
                      <Count value={stats.expectedLoss} format={eur} />
                    </strong>
                    <small>Review cost + expected mistakes</small>
                  </div>
                  <div>
                    <span>HUMAN REVIEW</span>
                    <strong>
                      <Count value={stats.review} />
                    </strong>
                    <small>{pct(stats.review / 600)} of the benchmark</small>
                    <i className="meter review">
                      <b style={{ width: pct(stats.review / 600) }} />
                    </i>
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
                            className="grid-line"
                          />
                          <text x="56" y={234 - v * 200} textAnchor="end">
                            {eur(v * maxLoss)}
                          </text>
                          <text x={65 + v * 470} y="253" textAnchor="middle">
                            {pct(v)}
                          </text>
                        </g>
                      ))}
                      <polyline
                        className="frontier-line"
                        pathLength={1}
                        points={policies
                          .map(
                            (p) =>
                              `${65 + p.automation * 470},${230 - (p.expectedLoss / maxLoss) * 200}`,
                          )
                          .join(' ')}
                      />
                      {policies.map((p, i) => (
                        <circle
                          key={i}
                          cx={65 + p.automation * 470}
                          cy={230 - (p.expectedLoss / maxLoss) * 200}
                          r={p === optimal ? 8 : 5.5}
                          onClick={() => setThresholds(p.thresholds)}
                          className={`frontier-dot ${p === optimal ? 'is-optimal' : ''}`}
                          style={{ animationDelay: `${300 + i * 60}ms` }}
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
            <AlertTriangle size={14} />
            <span>
              Experimental / educational decision-system simulation. Fictional cases. A bounded
              EU261 model, not legal advice or real claim eligibility.
            </span>
          </div>
        </section>
        <section id="methodology" className="methodology wrap reveal" ref={methodRef}>
          <div className="method-heading">
            <span className="eyebrow">
              <span className="gate-chip">GATE B</span> THE THINKING BEHIND THE ENGINE
            </span>
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
            <span className="itinerary-plane" aria-hidden="true">
              <Plane size={16} />
            </span>
            <ol>
              {(
                [
                  {
                    leg: 'LEG 01 / FACTS',
                    code: 'DEP',
                    title: 'Start with what’s known.',
                    text: 'Routes, notice periods, and arrival times are structured inputs. No AI needed.',
                  },
                  {
                    leg: 'LEG 02 / JUDGMENT',
                    code: 'VIA',
                    title: 'Ask a smaller question.',
                    text: 'Jev assesses cause, evidence, and clarity. It never decides whether to pay a claim. The 600-case benchmark uses recorded Jev assessments; edited cases can use synthetic fixtures or a fresh live assessment.',
                  },
                  {
                    leg: 'LEG 03 / CONSEQUENCE',
                    code: 'ARR',
                    title: 'Let code apply the policy.',
                    text: 'Source-linked rules calculate the consequence. Separate confidence gates determine whether to automate or ask a human.',
                  },
                ] as const
              ).map((s, i) => (
                <li key={s.leg} style={{ '--i': i } as React.CSSProperties}>
                  <span className="leg-code">{s.code}</span>
                  <div>
                    <span className="leg">{s.leg}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="source-strip wrap reveal" ref={sourceRef}>
          <div>
            <ShieldCheck size={20} />
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
      <footer className="site-footer wrap reveal" ref={footerRef}>
        <div className="bag-tag">
          <span className="tag-hole" aria-hidden="true" />
          <div>
            <small>PRIORITY · HANDLE WITH JUDGMENT</small>
            <a
              className="footer-name"
              href="https://ankitkapoor.me"
              target="_blank"
              rel="noreferrer"
            >
              An experiment by Ankit Kapoor <ArrowUpRight size={14} />
            </a>
            <p>Building systems that know when they don’t know enough.</p>
          </div>
          <div className="tag-code">
            <b>EXC</b>
            <Barcode value="ankitkapoor.me" />
          </div>
        </div>
        <div className="footer-links">
          <a href={GITHUB} target="_blank" rel="noreferrer">
            Explore the source <ArrowUpRight size={15} />
          </a>
          <span>POLICY × PROBABILITY × PEOPLE</span>
        </div>
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
            <span>
              <Ticket size={15} /> DECISION RECEIPT · AUDIT COPY
            </span>
            <button aria-label="Close decision receipt" onClick={() => setReceipt(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="receipt-body">
            <div className="eyebrow">THE EXCEPTION ENGINE / BOARDING PASS</div>
            <div className="receipt-route">
              <div>
                <small>FROM</small>
                <strong>{fromCode(flight)}</strong>
                <span>{flight.origin}</span>
              </div>
              <Plane size={22} />
              <div>
                <small>TO</small>
                <strong>{toCode(flight)}</strong>
                <span>{flight.destination}</span>
              </div>
            </div>
            <div className="receipt-title">
              <h2>{flight.id}</h2>
              {receipt && <Stamp outcome={decision.outcome} key={receiptTime} />}
            </div>
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
          </div>
          <div className="perforation" aria-hidden="true" />
          <div className="receipt-stub">
            <Barcode value={`${flight.id}${receiptTime}`} />
            <div className="receipt-bottom">
              <button
                className="button primary"
                onClick={() => saveFile(`${flight.id}-receipt.json`, receiptData(receiptTime))}
              >
                <Download size={15} /> Download full receipt
              </button>
              <button className="button secondary" onClick={() => window.print()}>
                <Printer size={15} /> Print / save PDF
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
