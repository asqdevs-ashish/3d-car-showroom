"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Cpu, Disc3, Wind, Armchair, Flame } from "lucide-react";
import type { HotspotId } from "@/config/cars";
import { useSelectedCar, useShowroom } from "@/hooks/useShowroomStore";
import { cn } from "@/lib/cn";

const ICONS: Record<HotspotId, typeof Cpu> = {
  engine: Cpu,
  brakes: Disc3,
  aero: Wind,
  interior: Armchair,
  exhaust: Flame,
};

/**
 * Expanded hotspot card.
 *
 * Anchored to the left rail on desktop, full-width sheeted on mobile. The
 * content comes straight from the car's hotspot config, so adding detail to
 * a car never requires touching this component.
 */
export function HotspotCard() {
  const car = useSelectedCar();
  const activeHotspot = useShowroom((s) => s.activeHotspot);
  const clear = useShowroom((s) => s.clearActiveHotspot);

  const isCurrentCar = activeHotspot?.carId === car.id;
  const hotspot = isCurrentCar
    ? car.hotspots.find((h) => h.id === activeHotspot?.hotspotId)
    : undefined;

  const Icon = hotspot ? (ICONS[hotspot.id] ?? Cpu) : Cpu;

  return (
    <AnimatePresence mode="wait">
      {hotspot && (
        <motion.aside
          key={`${car.id}-${hotspot.id}`}
          initial={{ opacity: 0, x: -24, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -16, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "glass-panel-strong noise-overlay pointer-events-auto relative w-full overflow-hidden",
            "sm:w-[320px]",
          )}
        >
          {/* Accent edge */}
          <span
            className="absolute inset-y-0 left-0 w-px"
            style={{ background: car.signature }}
          />

          <div className="relative p-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center border"
                  style={{
                    borderColor: `${car.signature}55`,
                    color: car.signature,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                </span>
                <span className="hud-label" style={{ color: car.signature }}>
                  {hotspot.label}
                </span>
              </div>

              <button
                type="button"
                onClick={clear}
                aria-label="Close feature detail"
                className="-mr-1 -mt-1 grid h-6 w-6 place-items-center text-white/35 transition-colors hover:text-titanium"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.6} />
              </button>
            </div>

            {/* Headline + body */}
            <h3 className="mt-4 font-display text-base font-bold uppercase leading-tight tracking-wide2 text-titanium">
              {hotspot.headline}
            </h3>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-white/55">
              {hotspot.detail}
            </p>

            {/* Micro-spec grid */}
            <dl className="mt-5 grid-cols-3 gap-px border-t border-white/8 pt-4">
              {hotspot.stats.map((stat) => (
                <div key={stat.label} className="pr-2">
                  <dt className="font-mono text-[8px] uppercase tracking-wide2 text-white/30">
                    {stat.label}
                  </dt>
                  <dd className="mt-1.5 font-display text-[13px] font-semibold leading-tight text-titanium">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
