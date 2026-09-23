"use client";

import { motion } from "framer-motion";
import { cars } from "@/config/cars";
import { useFilteredCars, useShowroom } from "@/hooks/useShowroomStore";
import { preloadCarModel } from "@/components/canvas/CarModel";
import { cn } from "@/lib/cn";

/**
 * Vertical car deck.
 *
 * A fixed rail of numbered entries on the right edge. Hovering preloads the
 * model so a click swaps the car with no stall. The active entry gets a
 * signature-coloured spine and a brand label that slides out.
 *
 * Desktop: vertical rail. Mobile: a horizontal scroller pinned above the
 * paint rail (rendered by CarHUD's mobile layout instead).
 */
export function CarDeck() {
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const selectCar = useShowroom((s) => s.selectCar);
  // Respects the active category filter — the rail only lists what's visible.
  const visibleCars = useFilteredCars();

  return (
    <nav
      aria-label="Vehicle selector"
      className="pointer-events-auto hidden flex-col items-end gap-1.5 lg:flex"
    >
      <p className="mb-2 mr-1 font-mono text-[9px] uppercase tracking-ultra text-white/30">
        {visibleCars.length} / {cars.length} Shown
      </p>

      {visibleCars.map((car, index) => {
        const isActive = car.id === selectedCarId;

        return (
          <button
            key={car.id}
            type="button"
            onClick={() => selectCar(car.id)}
            onMouseEnter={() => preloadCarModel(car.modelPath)}
            onFocus={() => preloadCarModel(car.modelPath)}
            aria-current={isActive ? "true" : undefined}
            className="group relative flex items-center justify-end gap-3 outline-none"
          >
            {/* Brand label — slides out on hover / stays out when active */}
            <span
              className={cn(
                "pointer-events-none whitespace-nowrap text-right font-display text-[10px] uppercase tracking-wide2 transition-all duration-300",
                isActive
                  ? "translate-x-0 text-titanium opacity-100"
                  : "translate-x-3 text-white/45 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
              )}
            >
              {car.brand}
            </span>

            {/* Numbered spine */}
            <span
              className={cn(
                "relative grid h-5 w-9 place-items-center border transition-all duration-300",
                isActive
                  ? "border-transparent"
                  : "border-white/8 group-hover:border-white/25",
              )}
              style={isActive ? { background: car.signature } : undefined}
            >
              <span
                className={cn(
                  "font-mono text-[8px] tabular-nums transition-colors duration-300",
                  isActive
                    ? "text-obsidian"
                    : "text-white/40 group-hover:text-titanium",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Active indicator bar */}
              {isActive && (
                <motion.span
                  layoutId="deck-active"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute -right-[10px] top-1/2 h-px w-2 -translate-y-1/2"
                  style={{ background: car.signature }}
                />
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Compact horizontal deck used under the mobile HUD. */
export function CarDeckMobile() {
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const selectCar = useShowroom((s) => s.selectCar);
  const visibleCars = useFilteredCars();

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {visibleCars.map((car, index) => {
        const isActive = car.id === selectedCarId;

        return (
          <button
            key={car.id}
            type="button"
            onClick={() => selectCar(car.id)}
            onMouseEnter={() => preloadCarModel(car.modelPath)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border px-2.5 py-2 transition-all duration-300",
              isActive ? "border-transparent" : "border-white/8",
            )}
            style={isActive ? { background: car.signature } : undefined}
          >
            <span
              className={cn(
                "font-mono text-[8px] tabular-nums",
                isActive ? "text-obsidian/60" : "text-white/35",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "font-display text-[9px] uppercase tracking-wide2",
                isActive ? "font-bold text-obsidian" : "text-white/60",
              )}
            >
              {car.brand}
            </span>
          </button>
        );
      })}
    </div>
  );
}
