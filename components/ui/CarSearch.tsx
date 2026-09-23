"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, CornerDownLeft } from "lucide-react";

import { cars } from "@/config/cars";
import { useShowroom } from "@/hooks/useShowroomStore";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { preloadCarModel } from "@/components/canvas/CarModel";
import { cn } from "@/lib/cn";

/**
 * Keyboard-first fleet search.
 *
 * Deliberately filtered from the raw `cars` list rather than the category
 * pool — a search is an explicit override, so typing "bugatti" should find
 * the Chiron even while "JDM" is the active badge. Selecting a result also
 * resets the filter to All so the chosen car is actually visible in the deck.
 *
 * Matches on brand, name, year, category and engine, so "v12", "2019" and
 * "koenigsegg" all work.
 */
export function CarSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectCar = useShowroom((s) => s.selectCar);
  const setCategoryFilter = useShowroom((s) => s.setCategoryFilter);
  const selectedCarId = useShowroom((s) => s.selectedCarId);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cars;

    return cars.filter((car) => {
      const haystack = [
        car.brand,
        car.name,
        String(car.year),
        car.category,
        car.specs.engine,
        car.tagline,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  /* Keep the highlight inside the result list as it shrinks. */
  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (index: number) => {
    const car = results[index];
    if (!car) return;
    // Reset the filter so the chosen car is definitely visible afterwards.
    setCategoryFilter("all");
    selectCar(car.id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(highlight);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className="pointer-events-auto relative w-full max-w-[420px]">
      {/* --- Input --- */}
      <div className="glass-panel flex items-center gap-2 px-3 py-2">
        <Search className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.6} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Delay close so a click on a result registers before the blur.
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onKeyDown={onKeyDown}
          placeholder="Search the fleet — brand, year, engine…"
          aria-label="Search vehicles"
          className="w-full bg-transparent font-mono text-[10px] uppercase tracking-wide2 text-titanium placeholder:text-white/25 outline-none"
        />

        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 text-white/35 transition-colors hover:text-titanium"
          >
            <X className="h-3 w-3" strokeWidth={1.6} />
          </button>
        ) : (
          <span className="shrink-0 border border-white/12 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide2 text-white/25">
            {results.length}
          </span>
        )}
      </div>

      {/* --- Results --- */}
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel-strong absolute bottom-full left-0 right-0 z-10 mb-2 max-h-[240px] overflow-y-auto"
          >
            {results.map((car, index) => {
              const isHighlighted = index === highlight;
              const isCurrent = car.id === selectedCarId;

              return (
                <li key={car.id}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setHighlight(index);
                      preloadCarModel(car.modelPath);
                    }}
                    onClick={() => commit(index)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-white/6 px-3 py-2.5 text-left transition-colors duration-200 last:border-b-0",
                      isHighlighted
                        ? "bg-white/[0.07]"
                        : "hover:bg-white/[0.04]",
                    )}
                  >
                    {/* Signature spine */}
                    <span
                      className="h-6 w-[2px] shrink-0"
                      style={{ background: car.signature }}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[8.5px] uppercase tracking-wide2 text-white/40">
                          {car.brand}
                        </span>
                        <span className="truncate font-display text-[11px] font-bold uppercase tracking-wide2 text-titanium">
                          {car.name}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-wide2 text-white/25">
                        <span>{car.year}</span>
                        <span>·</span>
                        <span className="truncate">{car.specs.engine}</span>
                      </span>
                    </span>

                    {isCurrent && (
                      <span className="shrink-0 font-mono text-[8px] uppercase tracking-wide2 text-gold">
                        On stage
                      </span>
                    )}

                    {isHighlighted && !isCurrent && (
                      <CornerDownLeft
                        className="h-3 w-3 shrink-0 text-white/30"
                        strokeWidth={1.6}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {open && query && results.length === 0 && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="glass-panel-strong absolute bottom-full left-0 right-0 z-10 mb-2 px-3 py-3 font-mono text-[9px] uppercase tracking-wide2 text-white/35"
          >
            No vehicle matches “{query}”
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Search is a desktop affordance: on a phone the results list would cover
 * the car entirely, and the category badges already narrow 14 cars to a
 * handful. Hidden below the `lg` breakpoint.
 */
export function useSearchVisible() {
  const isMobile = useIsMobile();
  return !isMobile;
}
