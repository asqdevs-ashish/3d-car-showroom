"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  /** Numeric portion of the value (parsed out of the spec string). */
  value: number;
  /** Optional text appended after the number, e.g. " hp". */
  suffix?: string;
  /** Decimal places to hold while counting. */
  decimals?: number;
  duration?: number;
  className?: string;
}

/**
 * Counts up to a target whenever it changes.
 *
 * Uses a rAF loop rather than a spring so the easing is fully under our
 * control (easeOutExpo-ish) and the counter never overshoots — an
 * overshooting number on a spec sheet looks like a bug, not a flourish.
 */
export function AnimatedCounter({
  value,
  suffix = "",
  decimals = 0,
  duration = 1400,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    const from = 0;
    const to = value;
    startRef.current = undefined;

    const tick = (timestamp: number) => {
      if (startRef.current === undefined) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo — fast out of the gate, long settle.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * Splits a spec string such as "1,914 hp" or "$3,900,000" into the numeric
 * part plus its affixes, so AnimatedCounter can animate it.
 */
export function parseSpec(raw: string): {
  value: number;
  suffix: string;
  prefix: string;
  decimals: number;
} {
  const match = raw.match(/([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return { value: 0, suffix: "", prefix: "", decimals: 0 };

  const [, prefix, numeric, suffix] = match;
  const cleaned = numeric.replace(/,/g, "");
  const decimals = cleaned.includes(".") ? cleaned.split(".")[1].length : 0;

  return {
    value: parseFloat(cleaned),
    prefix,
    // Re-attach the thousand separators for display.
    suffix,
    decimals,
  };
}
