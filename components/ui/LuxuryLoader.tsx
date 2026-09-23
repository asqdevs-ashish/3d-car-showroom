"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "@react-three/drei";

interface LuxuryLoaderProps {
  /** Called once the curtain has fully lifted. */
  onComplete?: () => void;
  /**
   * Hard ceiling on how long the curtain may stay up, in ms.
   *
   * This exists because drei's `useProgress` counts EVERY queued asset. The
   * showroom deliberately preloads the whole fleet in the background, so
   * waiting for `active === false` held the entry curtain for the full fleet
   * download (~38s measured) even though the hero car is ready far sooner.
   */
  maxDurationMs?: number;
}

/**
 * The entry curtain.
 *
 * Shows a real progress signal (drei's useProgress) but never lets the bar
 * snap forward — it eases toward the reported value so the motion stays
 * continuous even when assets resolve in bursts. The copy steps through
 * staged status lines so the wait feels like a valet process, not a stall.
 */
export function LuxuryLoader({ onComplete, maxDurationMs = 4500 }: LuxuryLoaderProps) {
  const { progress, active } = useProgress();
  const [displayed, setDisplayed] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const mountedAt = useRef<number>(Date.now());

  const stages = [
    "Opening the atelier",
    "Charging the grid",
    "Polishing the bodywork",
    "Warming the engine",
    "Stage ready",
  ];

  /* Hold the curtain briefly so the brand lands before anything moves. */
  useEffect(() => {
    const id = window.setTimeout(() => setHasStarted(true), 850);
    return () => window.clearTimeout(id);
  }, []);

  /*
   * Progress, guaranteed to only ever move FORWARD.
   *
   * The previous version read drei's `progress` directly, which is a property
   * of the CURRENT loading batch and resets to 0 whenever a new batch starts.
   * The neighbour-preload fires right after the hero car finishes, so the bar
   * would climb to 99, then snap back to ~48 when the next model began —
   * exactly the "99 jaa ke 48 ho jata" behaviour.
   *
   * Two rules now make that impossible:
   *   1. `peak` records the highest value ever seen and the target is never
   *      allowed below it. This is the property that actually fixes the bug.
   *   2. The target only tracks `progress` while the FIRST batch is in flight.
   *      Once it completes we stop listening to later batches entirely, because
   *      they are background work the user did not ask for.
   */
  const peak = useRef(0);
  const heroDone = useRef(false);

  useEffect(() => {
    let frame: number;

    const tick = () => {
      const elapsed = Date.now() - mountedAt.current;
      const forced = elapsed >= maxDurationMs;

      setDisplayed((current) => {
        /*
         * Past the ceiling the curtain MUST lift. Snapping to 100 (rather than
         * easing asymptotically) matters because the completion effect below
         * gates on `displayed === 100`, and an asymptotic approach never
         * satisfies that — which previously left the z-[100] curtain mounted
         * over the whole app, swallowing every click.
         */
        if (forced) {
          peak.current = 100;
          return 100;
        }

        /*
         * Once the hero batch has finished, freeze the source of truth.
         * Later batches (neighbour preloads) must not influence the bar at
         * all, or it will visibly rewind.
         */
        if (!active) heroDone.current = true;

        /*
         * A steady time-based floor means the bar always advances even during
         * a slow first byte, so it never looks stalled.
         */
        const timeFloor = (elapsed / maxDurationMs) * 88;

        const fromNetwork = heroDone.current ? 100 : active ? progress : 100;

        /*
         * `peak` is the whole fix: the target is the max of every signal we
         * have ever seen, so a reset in drei's counter cannot drag it back.
         */
        peak.current = Math.max(peak.current, fromNetwork, timeFloor);

        const target = Math.min(99, peak.current);
        const next = current + (target - current) * 0.14;

        /* Also monotonic — never return a value below what is on screen. */
        const clamped = Math.max(current, next >= 99 ? 99 : next);
        return clamped;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress, active, maxDurationMs]);

  /* Fire completion once we've visually reached the end. */
  useEffect(() => {
    if (displayed < 100 || !hasStarted) return;
    const id = window.setTimeout(() => onComplete?.(), 450);
    return () => window.clearTimeout(id);
  }, [displayed, hasStarted, onComplete]);

  /*
   * Absolute failsafe.
   *
   * The curtain sits at z-[100] over the entire app, so if anything in the
   * progress logic ever fails to reach 100 the showroom becomes completely
   * unclickable — every badge, swatch and modal behind it is blocked. This
   * guarantees the lift regardless of what the animation loop does.
   */
  useEffect(() => {
    const id = window.setTimeout(
      () => onComplete?.(),
      maxDurationMs + 2500,
    );
    return () => window.clearTimeout(id);
    // Runs once per mount; onComplete is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDurationMs]);

  const stageIndex = Math.min(
    stages.length - 1,
    Math.floor((displayed / 100) * stages.length),
  );

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
      className="noise-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center bg-obsidian"
    >
      {/* Faint grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, #000 20%, transparent 72%)",
        }}
      />

      {/* Slow scan line for depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-scan-line h-32 w-full bg-gradient-to-b from-transparent via-white/[0.045] to-transparent" />
      </div>

      <div className="relative flex w-[min(88vw,460px)] flex-col items-center">
        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="text-center"
        >
          <p className="font-mono text-[9px] uppercase tracking-ultra text-white/30">
            A Square Devs
          </p>
          <h1 className="chrome-text mt-3 font-display text-[30px] font-extrabold uppercase leading-none tracking-tight sm:text-[42px]">
            Cars
          </h1>
        </motion.div>

        {/* Progress readout */}
        <div className="mt-12 flex w-full items-end justify-between">
          <AnimatePresence mode="wait">
            <motion.span
              key={stageIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="font-mono text-[9px] uppercase tracking-wide2 text-white/40"
            >
              {stages[stageIndex]}
            </motion.span>
          </AnimatePresence>

          <span className="font-display text-2xl font-bold tabular-nums leading-none text-titanium">
            {Math.round(displayed)}
            <span className="ml-0.5 font-mono text-[10px] font-normal text-white/30">
              %
            </span>
          </span>
        </div>

        {/* The bar: a hairline track with a gold-to-neon fill */}
        <div className="relative mt-4 h-px w-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${displayed}%`,
              background:
                "linear-gradient(90deg, #8C6F1F, #D4AF37 60%, #00F0FF)",
            }}
          />
          {/* Leading head glow */}
          <motion.div
            className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-neon"
            style={{
              left: `calc(${displayed}% - 3px)`,
              boxShadow: "0 0 12px #00F0FF",
            }}
          />
        </div>

        <p className="mt-6 font-mono text-[8px] uppercase tracking-ultra text-white/20">
          Loading showroom environment
        </p>
      </div>
    </motion.div>
  );
}
