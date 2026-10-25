import { useEffect, useMemo, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Departure-board text: each character cycles through glyphs before settling. */
export function SplitFlap({
  text,
  pad = 0,
  className = '',
}: {
  text: string;
  pad?: number;
  className?: string;
}) {
  const target = text.toUpperCase().padEnd(pad, ' ');
  const [shown, setShown] = useState(target);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      let settled = true;
      const next = Array.from(target, (ch, i) => {
        if (ch === ' ' || frame >= 3 + i * 1.6) return ch;
        settled = false;
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }).join('');
      setShown(next);
      if (settled) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [target, reduced]);
  return (
    <span className={`split-flap ${className}`}>
      <span className="visually-hidden">{text}</span>
      {Array.from(shown).map((ch, i) => (
        <span className="flap" aria-hidden="true" key={i}>
          <span key={ch}>{ch === ' ' ? ' ' : ch}</span>
        </span>
      ))}
    </span>
  );
}

/** Eases a number toward its latest value; counts up from zero on first render. */
export function Count({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState(reduced ? value : 0);
  const from = useRef(current);
  useEffect(() => {
    if (reduced) {
      from.current = value;
      setCurrent(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const next = origin + (value - origin) * (1 - Math.pow(1 - p, 3));
      from.current = next;
      setCurrent(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <>{format(current)}</>;
}

/** A decorative, deterministic barcode derived from any string. */
export function Barcode({ value, className = '' }: { value: string; className?: string }) {
  const bars = useMemo(() => {
    let seed = Array.from(value).reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
    const out: [number, number][] = [];
    for (let x = 0; x < 196;) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const width = 1 + (seed % 3);
      out.push([x, width]);
      x += width + 1 + ((seed >>> 4) % 3);
    }
    return out;
  }, [value]);
  return (
    <svg
      className={`barcode ${className}`}
      viewBox="0 0 196 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map(([x, w]) => (
        <rect key={x} x={x} width={w} height="40" />
      ))}
    </svg>
  );
}

/** Adds `is-in` once the element scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}
