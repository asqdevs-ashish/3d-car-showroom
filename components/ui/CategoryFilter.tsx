"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";

import { CAR_CATEGORIES, cars, type CarCategory } from "@/config/cars";
import {
  useShowroom,
  type CategoryFilter as FilterValue,
} from "@/hooks/useShowroomStore";
import { cn } from "@/lib/cn";

/**
 * Short label for the inline identity badge, where space is tight.
 * The filter bar uses the longer `CAR_CATEGORIES` labels.
 */
const SHORT_LABEL: Record<CarCategory, string> = {
  hypercar: "Hypercar",
  track: "Track / GT3",
  supercar: "Supercar",
  muscle: "Muscle",
  jdm: "JDM",
};

/** Coloured chip shown next to the car's name. */
export function CarCategoryBadge({
  category,
  accent,
}: {
  category: CarCategory;
  accent: string;
}) {
  return (
    <span
      className="flex items-center gap-1 border px-1.5 py-0.5"
      style={{ borderColor: `${accent}44`, color: accent }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
      <span className="font-mono text-[8px] uppercase tracking-wide2">
        {SHORT_LABEL[category]}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Filter bar                                                          */
/* ------------------------------------------------------------------ */

/**
 * Category filter badges.
 *
 * Counts are derived from the fleet itself rather than hard-coded, so adding
 * a car to `config/cars.ts` updates the badges automatically — and a
 * category with no cars is never rendered as an empty dead end.
 */
export function CategoryFilter() {
  const categoryFilter = useShowroom((s) => s.categoryFilter);
  const setCategoryFilter = useShowroom((s) => s.setCategoryFilter);
  const selectCar = useShowroom((s) => s.selectCar);

  const counts = cars.reduce<Record<string, number>>((acc, car) => {
    acc[car.category] = (acc[car.category] ?? 0) + 1;
    return acc;
  }, {});

  const badges: { id: FilterValue; label: string; count: number }[] = [
    { id: "all", label: "All", count: cars.length },
    ...CAR_CATEGORIES.filter((c) => (counts[c.id] ?? 0) > 0).map((c) => ({
      id: c.id as FilterValue,
      label: c.label,
      count: counts[c.id] ?? 0,
    })),
  ];

  const handleSelect = (id: FilterValue) => {
    setCategoryFilter(id);

    /*
     * If the currently-shown car falls outside the new filter, move to the
     * first car that IS in it. Leaving the user on an invisible car — with
     * the picker filtered but the stage showing something excluded — reads
     * as a bug.
     */
    const pool = id === "all" ? cars : cars.filter((c) => c.category === id);
    const current = useShowroom.getState().selectedCarId;
    if (pool.length > 0 && !pool.some((c) => c.id === current)) {
      selectCar(pool[0].id);
    }
  };

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
      <LayoutGrid
        className="mr-0.5 h-3 w-3 text-white/25"
        strokeWidth={1.5}
        aria-hidden
      />

      {badges.map((badge) => {
        const isActive = badge.id === categoryFilter;

        return (
          <button
            key={badge.id}
            type="button"
            onClick={() => handleSelect(badge.id)}
            aria-pressed={isActive}
            className={cn(
              "relative flex items-center gap-1.5 border px-2.5 py-1.5 transition-all duration-300",
              isActive
                ? "border-titanium/60 bg-white/[0.07] text-titanium"
                : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/75",
            )}
          >
            {/*
             * Active underline.
             *
             * NOTE: this uses a UNIQUE layoutId. Framer Motion's shared-layout
             * animation resolves any duplicate layoutId across the whole tree,
             * and when a filter change unmounts the deck's `deck-active`
             * indicator in the same commit it throws and takes the page down.
             * Each component therefore namespaces its own id.
             */}
            {isActive && (
              <motion.span
                layoutId="category-filter-active"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-x-0 -bottom-px h-px bg-gold"
              />
            )}

            <span className="font-mono text-[8.5px] uppercase tracking-wide2">
              {badge.label}
            </span>

            {/* Count chip */}
            <span
              className={cn(
                "font-mono text-[8px] tabular-nums",
                isActive ? "text-gold" : "text-white/25",
              )}
            >
              {String(badge.count).padStart(2, "0")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
