"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ChevronDown, AlertTriangle, Gauge, Timer, Zap, Cog, Tag } from "lucide-react";

import {
  useSelectedCar,
  useSelectedCarError,
  useShowroom,
} from "@/hooks/useShowroomStore";
import { useQuality } from "@/hooks/useAdaptiveQuality";
import { CarCategoryBadge, CategoryFilter } from "./CategoryFilter";
import { CarSearch, useSearchVisible } from "./CarSearch";
import { HUDErrorBoundary } from "./HUDErrorBoundary";
import { BottomSheet } from "./BottomSheet";
import { CarPillSwitcher, CompactStats } from "./CarPillSwitcher";
import { QualityIndicator } from "./QualityIndicator";
import { parseSpec, AnimatedCounter } from "./AnimatedCounter";
import { PaintConfigurator } from "./PaintConfigurator";
import { CarDeck } from "./CarDeck";
import { CameraRail } from "./CameraRail";
import { HotspotCard } from "./HotspotCard";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Spec tile                                                           */
/* ------------------------------------------------------------------ */

interface SpecTileProps {
  label: string;
  raw: string;
  icon: typeof Gauge;
  accent: string;
  /** Price renders as a static string — animating a currency looks cheap. */
  static?: boolean;
}

function SpecTile({
  label,
  raw,
  icon: Icon,
  accent,
  static: isStatic,
}: SpecTileProps) {
  const { value, prefix, suffix, decimals } = parseSpec(raw);

  return (
    <div className="group relative flex-1 px-4 py-3.5">
      {/* Hairline separator between tiles */}
      <span className="absolute inset-y-3 left-0 w-px bg-white/8 first:hidden" />

      <div className="flex items-center gap-1.5">
        <Icon
          className="h-3 w-3 transition-colors duration-300"
          strokeWidth={1.6}
          style={{ color: `${accent}99` }}
        />
        <span className="font-mono text-[8.5px] uppercase tracking-wide2 text-white/35">
          {label}
        </span>
      </div>

      <p className="mt-2.5 flex items-baseline font-display text-xl font-bold leading-none tracking-tight text-titanium sm:text-2xl">
        {isStatic ? (
          <span>{raw}</span>
        ) : (
          <>
            {prefix && <span className="mr-0.5 text-white/55">{prefix}</span>}
            <AnimatedCounter value={value} decimals={decimals} />
            {suffix && (
              <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-wide2 text-white/45">
                {suffix}
              </span>
            )}
          </>
        )}
      </p>

      {/* Active underline that grows on hover */}
      <span
        className="absolute bottom-0 left-4 h-px w-0 transition-all duration-500 group-hover:w-[calc(100%-2rem)]"
        style={{ background: accent }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Car identity block                                                  */
/* ------------------------------------------------------------------ */

function CarIdentity() {
  const car = useSelectedCar();
  const stepCar = useShowroom((s) => s.stepCar);
  const modelError = useSelectedCarError();

  return (
    /* pointer-events-auto: the fleet step buttons must stay clickable even
     * though the HUD root disables pointer events. */
    <div className="pointer-events-auto flex items-start justify-between gap-4">
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={car.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="font-mono text-[9px] uppercase tracking-ultra"
                style={{ color: car.signature }}
              >
                {car.brand}
              </span>
              <span className="h-2 w-px bg-white/15" />
              {/* Year badge */}
              <span className="border border-white/12 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide2 text-white/45">
                {car.year}
              </span>
              <CarCategoryBadge category={car.category} accent={car.signature} />
            </div>

            <h2 className="mt-2 font-display text-[26px] font-extrabold uppercase leading-[0.95] tracking-tight text-titanium sm:text-4xl">
              {car.name}
            </h2>

            <p className="mt-2 max-w-[26ch] text-[12px] leading-snug text-white/45">
              {car.tagline}
            </p>

            {/*
             * Honest failure state. Silently showing an empty stage would be
             * worse than telling the user the model is unavailable.
             */}
            {modelError && (
              <div className="mt-3 flex items-start gap-2 border border-red-500/25 bg-red-500/[0.07] px-2.5 py-2">
                <AlertTriangle
                  className="mt-px h-3 w-3 shrink-0 text-red-400"
                  strokeWidth={1.6}
                />
                <div className="min-w-0">
                  <p className="font-mono text-[8.5px] uppercase tracking-wide2 text-red-300/90">
                    Model unavailable
                  </p>
                  {/*
                   * Show the ACTUAL reason, then the path. Previously this
                   * always printed `car.modelPath` and discarded the reason
                   * entirely, so every failure looked identical and gave the
                   * user nothing actionable.
                   */}
                  <p className="mt-0.5 text-[10px] leading-snug text-red-200/60">
                    {modelError}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-red-200/35">
                    {car.modelPath}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fleet step control */}
      <div className="flex shrink-0 flex-col border-white/10">
        <button
          type="button"
          onClick={() => stepCar(1)}
          aria-label="Next vehicle"
          className="grid h-7 w-7 place-items-center text-white/40 transition-colors hover:text-titanium"
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        <span className="h-px w-7 bg-white/10" />
        <button
          type="button"
          onClick={() => stepCar(-1)}
          aria-label="Previous vehicle"
          className="grid h-7 w-7 place-items-center text-white/40 transition-colors hover:text-titanium"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spec sheet                                                          */
/* ------------------------------------------------------------------ */

function SpecSheet() {
  const car = useSelectedCar();

  return (
    <div className="glass-panel-strong noise-overlay pointer-events-auto relative overflow-hidden">
      {/* Accent hairline */}
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${car.signature}, transparent)`,
        }}
      />

      <div className="flex flex-wrap sm:flex-nowrap">
        <SpecTile
          label="Power"
          raw={car.specs.horsepower}
          icon={Zap}
          accent={car.signature}
        />
        <SpecTile
          label="0–60 mph"
          raw={car.specs.zeroToSixty}
          icon={Timer}
          accent={car.signature}
        />
        <SpecTile
          label="V-Max"
          raw={car.specs.topSpeed}
          icon={Gauge}
          accent={car.signature}
        />
        <SpecTile
          label="Powertrain"
          raw={car.specs.engine}
          icon={Cog}
          accent={car.signature}
          static
        />
        <SpecTile
          label="Estimate"
          raw={car.specs.price}
          icon={Tag}
          accent={car.signature}
          static
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */

/**
 * The full 2D overlay.
 *
 * Layout is a five-point compass around the canvas:
 *   top-left     → car identity
 *   left-middle  → hotspot feature card
 *   right-middle → car deck + camera rail
 *   bottom       → spec sheet + paint configurator
 *
 * `pointer-events-none` on the root means drags over empty space still
 * orbit the car; only the individual controls opt back in.
 */
export function CarHUD() {
  const car = useSelectedCar();
  const showSearch = useSearchVisible();

  /*
   * TEMPORARY DIAGNOSTIC OVERLAY.
   *
   * After many cycles of inferring why the stage is empty, this prints the
   * facts from inside the render tree where they can actually be read. Removed
   * as soon as the cause is confirmed.
   */
  const [diag, setDiag] = useState<string>("");
  useEffect(() => {
    const read = () => {
      const v = document.body.getAttribute("data-diag");
      if (v) setDiag(v);
    };
    const id = window.setInterval(read, 400);
    read();
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {diag && (
        <div className="pointer-events-none absolute bottom-1 left-1 z-[60] max-w-[92vw] truncate bg-black/80 px-2 py-1 font-mono text-[9px] text-lime-300">
          {diag}
        </div>
      )}

      {/* ============================================================ */}
      {/* DESKTOP — floating glass cards anchored to the viewport          */}
      {/* ============================================================ */}
      {/*
       * The overlay is a real flex column pinned to the viewport.
       *
       * `flex` is not optional here: with only `flex-col` the container stays a
       * block, the rows stack past the bottom edge, and the paint rail ends up
       * outside the viewport — where the canvas, which sits above it in the
       * hit-test stack, swallows every click meant for a swatch.
       */}
      <div className="pointer-events-none absolute inset-0 z-30 hidden h-full flex-col justify-between p-7 lg:flex">
        {/* ---- Top row ---- */}
        <div className="flex shrink-0 items-start justify-between gap-6">
          <div className="mt-16 w-full max-w-[420px]">
            <CarIdentity />
          </div>

          {/**
           * Right column: quality readout above the fleet deck.
           *
           * `shrink-0` and `items-end` keep the whole stack anchored to the
           * right padding edge instead of growing past it.
           */}
          <div className="flex shrink-0 flex-col items-end gap-2 pt-12">
            <QualityIndicator accent={car.signature} />
            <CarDeck />
          </div>
        </div>

        {/* ---- Middle row ---- */}
        <div className="pointer-events-none flex min-h-0 flex-1 items-start justify-between gap-6 py-4">
          <div className="w-[320px] shrink-0">
            <HotspotCard />
          </div>

          {/**
           * Camera rail.
           *
           * Moved OUT of the top row and given an explicit width. It used to
           * share the right-hand column with the fleet deck, where the two
           * stacked and pushed past the viewport edge — the rail's labels were
           * clipped and it overlapped the deck's numbers.
           *
           * `shrink-0` plus a fixed width keeps it inside the padding box.
           */}
          <div className="hidden w-[190px] shrink-0 xl:block">
            <CameraRail accent={car.signature} />
          </div>
        </div>

        {/* ---- Bottom row ---- */}
        <div className="flex shrink-0 flex-col gap-3">
          <div className="pointer-events-auto flex max-w-[880px] flex-col gap-2">
            <HUDErrorBoundary label="Category filter">
              <CategoryFilter />
            </HUDErrorBoundary>
            {showSearch && (
              <HUDErrorBoundary label="Fleet search">
                <CarSearch />
              </HUDErrorBoundary>
            )}
          </div>

          <div className="pointer-events-auto w-full max-w-[880px]">
            <SpecSheet />
          </div>

          <div className="pointer-events-auto flex shrink-0 justify-center">
            <PaintConfigurator colors={car.colors} accent={car.signature} />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE / TABLET — compact overlay + expandable bottom sheet      */}
      {/* ============================================================ */}
      <div className="pointer-events-none absolute inset-0 z-30 flex h-full flex-col justify-between lg:hidden">
        {/* ---- Top: identity only, safe-area aware ---- */}
        <div
          className="pointer-events-auto pt-[max(3.5rem,calc(var(--safe-top)+3rem))]"
          style={{
            paddingLeft: "max(1rem, var(--safe-left))",
            paddingRight: "max(1rem, var(--safe-right))",
          }}
        >
          <CarIdentity />
        </div>

        {/* ---- Middle: hotspot card floats above the sheet ---- */}
        <div className="pointer-events-none flex-1 overflow-hidden px-4 pt-3">
          <HotspotCard />
        </div>

        {/*
         * Bottom spacer: the sheet is fixed, so this reserves its height and
         * leaves the pill switcher sitting just above it rather than hidden
         * underneath.
         */}
        <div className="pointer-events-auto shrink-0 pb-28">
          <CarPillSwitcher />
        </div>
      </div>

      {/*
       * The sheet lives OUTSIDE the flex containers above so its fixed
       * positioning and drag transform are not inherited from an ancestor
       * with a transform — which would break `position: fixed` on iOS.
       */}
      <BottomSheet
        label="Show vehicle details"
        accent={car.signature}
        summary={
          <div className="flex items-center justify-between gap-4">
            <CompactStats />
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
              style={{ borderColor: `${car.signature}55` }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: car.signature }}
              />
            </span>
          </div>
        }
      >
        {/* Expanded sheet content: specs, filters, paint, camera shots */}
        <div className="flex flex-col gap-4 pb-3">
          {/*
           * Strip the spec sheet's own glass chrome inside the sheet — it is
           * already sitting on a glass surface, and doubling the backdrop
           * blur is both visually muddy and genuinely expensive on a phone.
           */}
          <div className="[&_.glass-panel-strong]:border-0 [&_.glass-panel-strong]:!bg-transparent [&_.glass-panel-strong]:!backdrop-blur-none">
            <SpecSheet />
          </div>

          <HUDErrorBoundary label="Category filter">
            <CategoryFilter />
          </HUDErrorBoundary>

          <div className="flex justify-center">
            <PaintConfigurator colors={car.colors} accent={car.signature} />
          </div>

          <div className="flex justify-center">
            <CameraRail accent={car.signature} />
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
