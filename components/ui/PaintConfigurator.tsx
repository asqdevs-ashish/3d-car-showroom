"use client";

import { motion } from "framer-motion";
import type { CarPaint } from "@/config/cars";
import { useShowroom } from "@/hooks/useShowroomStore";
import { cn } from "@/lib/cn";

interface PaintConfiguratorProps {
  colors: CarPaint[];
  accent: string;
}

/**
 * Paint configurator wheel.
 *
 * Swatches sit in a horizontal rail anchored bottom-centre. The active
 * swatch lifts and grows a connector line up to the paint name — so the
 * selection is legible without a tooltip on touch devices.
 */
export function PaintConfigurator({ colors, accent }: PaintConfiguratorProps) {
  const paintColor = useShowroom((s) => s.paintColor);
  const paintName = useShowroom((s) => s.paintName);
  const setPaint = useShowroom((s) => s.setPaint);

  return (
    /* The HUD root is pointer-events-none so drags over empty space still
     * orbit the car — every interactive subtree has to opt back in. */
    <div className="pointer-events-auto flex flex-col items-center gap-3">
      {/* Paint name readout — swaps with a soft vertical wipe */}
      <div className="flex h-4 items-center overflow-hidden">
        <motion.p
          key={paintName}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-[9px] uppercase tracking-ultra text-white/55"
        >
          {paintName}
        </motion.p>
      </div>

      {/* Swatch rail */}
      <div className="glass-panel flex items-center gap-1.5 rounded-full px-2 py-2">
        {colors.map((paint) => {
          const isActive = paint.hex.toLowerCase() === paintColor.toLowerCase();

          return (
            <button
              key={paint.hex}
              type="button"
              onClick={() => setPaint(paint.hex, paint.name)}
              aria-label={`Apply ${paint.name}`}
              aria-pressed={isActive}
              title={paint.name}
              className="group relative grid h-7 w-7 place-items-center outline-none"
            >
              {/* Active selection ring */}
              {isActive && (
                <motion.span
                  layoutId="paint-ring"
                  transition={{ type: "spring", stiffness: 460, damping: 34 }}
                  className="absolute inset-0 rounded-full"
                  style={{ border: `1.5px solid ${accent}` }}
                />
              )}

              {/* Colour chip */}
              <span
                className={cn(
                  "h-4 w-4 rounded-full transition-all duration-300 group-hover:h-[18px] group-hover:w-[18px]",
                  isActive && "h-[18px] w-[18px]",
                )}
                style={{
                  background: paint.accent
                    ? `linear-gradient(135deg, ${paint.hex} 0%, ${paint.hex} 48%, ${paint.accent} 52%, ${paint.accent} 100%)`
                    : paint.hex,
                  boxShadow:
                    paint.matte && paint.matte > 0.4
                      ? "inset 0 0 0 1px rgba(255,255,255,0.14)"
                      : `0 0 10px ${paint.hex}66, inset 0 1px 2px rgba(255,255,255,0.35)`,
                }}
              />

              {/* Matte marker — a hairline dot signals a satin finish */}
              {paint.matte && paint.matte > 0.4 && (
                <span className="absolute -bottom-0.5 h-[2px] w-2 rounded-full bg-white/30" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
