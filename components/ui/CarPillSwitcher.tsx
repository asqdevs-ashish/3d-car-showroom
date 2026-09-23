"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  useFilteredCars,
  useSelectedCar,
  useShowroom,
} from "@/hooks/useShowroomStore";
import { preloadCarModel } from "@/components/canvas/CarModel";
import { cn } from "@/lib/cn";

/**
 * Touch-friendly swipeable pill list.
 *
 * A horizontal scroller with snap points so a flick always lands on a card
 * rather than halfway between two — the carousel equivalent of giving the
 * user a place for their thumb to stop.
 *
 * The active pill is scrolled into view on selection, which matters when the
 * user changes cars from the sheet or with the arrow buttons rather than by
 * tapping a pill directly.
 */
export function CarPillSwitcher() {
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const selectCar = useShowroom((s) => s.selectCar);
  const visibleCars = useFilteredCars();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /* Keep the active pill on screen when the selection changes elsewhere. */
  useEffect(() => {
    const el = activeRef.current;
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;

    const target =
      el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({
      left: Math.max(0, target),
      behavior: "smooth",
    });
  }, [selectedCarId]);

  if (visibleCars.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      /*
       * `snap-x snap-mandatory` plus `touch-action: pan-x` gives native
       * momentum scrolling with snap points — smoother than any JS carousel
       * on mobile, and it costs nothing.
       */
      className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-4 py-2"
      style={{ touchAction: "pan-x" }}
      role="tablist"
      aria-label="Vehicle selector"
    >
      {visibleCars.map((car) => {
        const isActive = car.id === selectedCarId;

        return (
          <button
            key={car.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => selectCar(car.id)}
            onTouchStart={() => preloadCarModel(car.modelPath)}
            onMouseEnter={() => preloadCarModel(car.modelPath)}
            className={cn(
              "relative flex shrink-0 snap-center items-center gap-2 rounded-full border px-3.5 py-2.5",
              "transition-colors duration-300",
              isActive
                ? "border-transparent"
                : "border-white/12 bg-white/[0.03]",
            )}
            style={isActive ? { background: car.signature } : undefined}
          >
            {/* Signature dot */}
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: isActive ? "#08080A" : car.signature,
              }}
            />

            <span className="flex flex-col items-start leading-none">
              <span
                className={cn(
                  "font-mono text-[7.5px] uppercase tracking-wide2",
                  isActive ? "text-obsidian/60" : "text-white/35",
                )}
              >
                {car.brand}
              </span>
              <span
                className={cn(
                  "mt-0.5 whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-wide2",
                  isActive ? "text-obsidian" : "text-white/70",
                )}
              >
                {car.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact single-row stats for the collapsed sheet.
 *
 * Three numbers, no chrome — the whole point is to keep viewport height
 * available for the 3D view, so this must never wrap to a second line.
 */
export function CompactStats() {
  const car = useSelectedCar();

  const items = useMemo(
    () => [
      { label: "HP", value: car.specs.horsepower.replace(/\s*hp$/i, "") },
      { label: "0–60", value: car.specs.zeroToSixty },
      { label: "V-MAX", value: car.specs.topSpeed.replace(/\s*mph$/i, "") },
    ],
    [car],
  );

  return (
    <div className="flex items-end gap-3">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-end gap-3">
          {index > 0 && <span className="mb-1 h-5 w-px bg-white/10" />}
          <div className="leading-none">
            <p className="font-display text-[15px] font-bold tabular-nums text-titanium">
              {item.value}
            </p>
            <p className="mt-1 font-mono text-[7.5px] uppercase tracking-wide2 text-white/35">
              {item.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
