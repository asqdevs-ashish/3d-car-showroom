"use client";

import { useEffect } from "react";
import { Gauge, Check } from "lucide-react";

import {
  QUALITY_PRESETS,
  useQuality,
  type QualityTier,
} from "@/hooks/useAdaptiveQuality";
import { cn } from "@/lib/cn";

const TIERS: QualityTier[] = ["low", "medium", "high"];

/**
 * Live quality readout + manual override.
 *
 * The adaptive system is automatic, but an automatic system the user cannot
 * see or override feels like a bug when it fires — reflections suddenly
 * softening reads as breakage unless you know why. This exposes the current
 * tier and lets the user pin it.
 *
 * Pinning sets `manual`, which stops PerformanceMonitor from overriding the
 * choice; otherwise the next slow frame would silently undo the selection.
 */
export function QualityIndicator({ accent }: { accent: string }) {
  const tier = useQuality((s) => s.tier);
  const setTier = useQuality((s) => s.setTier);
  const setManual = useQuality((s) => s.setManual);
  const manual = useQuality((s) => s.manual);

  /* Re-arm the automation if the component unmounts while pinned. */
  useEffect(() => () => setManual(false), [setManual]);

  return (
    <div className="glass-panel pointer-events-auto flex items-center gap-2 px-2.5 py-1.5">
      <Gauge
        className={cn(
          "h-3 w-3 shrink-0",
          manual ? "text-gold" : "text-white/30",
        )}
        strokeWidth={1.6}
        aria-hidden
      />

      <span className="font-mono text-[7.5px] uppercase tracking-wide2 text-white/35">
        {manual ? "Locked" : "Auto"}
      </span>

      <span className="h-3 w-px bg-white/10" />

      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Render quality"
      >
        {TIERS.map((value) => {
          const isActive = value === tier;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              title={QUALITY_PRESETS[value].label}
              onClick={() => {
                setManual(true);
                setTier(value);
              }}
              className={cn(
                "flex items-center gap-1 px-1.5 py-1 transition-colors duration-200",
                isActive
                  ? "text-titanium"
                  : "text-white/30 hover:text-white/60",
              )}
            >
              {/* Three ascending bars — legible at 8px where text is not. */}
              <span className="flex items-end gap-[2px]" aria-hidden>
                {[0, 1, 2].map((bar) => (
                  <span
                    key={bar}
                    className="w-[3px] rounded-sm transition-all duration-200"
                    style={{
                      height: `${4 + bar * 3}px`,
                      background:
                        bar <= TIERS.indexOf(value)
                          ? isActive
                            ? accent
                            : "rgba(255,255,255,0.35)"
                          : "rgba(255,255,255,0.12)",
                    }}
                  />
                ))}
              </span>

              {isActive && (
                <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
