import { useEffect, useRef, useState } from 'react';

/**
 * Browser adaptation of @remocn/number-wheel (Odometer): the same 0–9–0 column
 * mechanics with translateY, spring-like carry roll of higher digits, and
 * fade-in of leading digits — but frames are driven by a time-based rAF, not
 * Remotion (useCurrentFrame needs a composition context and pulls remotion
 * into the bundle).
 */

export interface OdometerProps {
  value: number;
  /** Count-up duration, ms. */
  duration?: number;
  className?: string;
}

// Threshold past which a digit's fractional part starts the roll (same as the original).
const WHEEL_ROLL_START = 0.9;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function rollFraction(current: number, place: number): number {
  const v = current / 10 ** place;
  const frac = v - Math.floor(v);
  if (frac <= WHEEL_ROLL_START) return 0;
  return (frac - WHEEL_ROLL_START) / (1 - WHEEL_ROLL_START);
}

function computeWheel(current: number, place: number): number {
  if (current <= 0) return 0;
  if (place === 0) return current % 10;

  const digit = Math.floor(current / 10 ** place) % 10;
  const t = rollFraction(current, place);
  if (t <= 0) return digit;
  return digit + easeOutCubic(t);
}

function placeOpacity(current: number, place: number): number {
  if (place === 0) return 1;
  const threshold = 10 ** place;
  const t = (current - threshold * 0.9) / (threshold * 0.1);
  return Math.min(1, Math.max(0, t));
}

function DigitColumn({ value, opacity }: { value: number; opacity: number }) {
  return (
    <span
      className="inline-block overflow-hidden text-center align-top"
      style={{ height: '1.1em', width: '0.62em', opacity }}
    >
      <span className="flex flex-col" style={{ transform: `translateY(${-value * 1.1}em)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
          <span key={i} style={{ height: '1.1em', lineHeight: '1.1em' }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// 400ms matches the recharts bar/donut entrance timing so all load animations stay in sync.
export function Odometer({ value, duration = 400, className }: OdometerProps) {
  const [current, setCurrent] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = value;
      setCurrent(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const next = from + (value - from) * easeOutCubic(p);
      setCurrent(next);
      if (p < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const places = Math.max(1, String(Math.max(1, Math.floor(value))).length);

  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden className="inline-flex font-mono tabular-nums">
        {Array.from({ length: places }, (_, i) => places - 1 - i).map((place) => (
          <DigitColumn
            key={place}
            value={computeWheel(current, place)}
            opacity={placeOpacity(current, place)}
          />
        ))}
      </span>
    </span>
  );
}
