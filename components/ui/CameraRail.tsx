"use client";

import { motion } from "framer-motion";
import { Video } from "lucide-react";
import { cameraPresets } from "@/config/camera";
import { useShowroom } from "@/hooks/useShowroomStore";
import { cn } from "@/lib/cn";

/**
 * Cinematic camera rail.
 *
 * Each entry is a shot, not a "view mode". Clicking flies the camera via
 * the registered Canvas API; the active entry keeps a moving indicator so
 * the user always knows which framing they're in.
 */
export function CameraRail({ accent }: { accent: string }) {
  const cameraPresetId = useShowroom((s) => s.cameraPresetId);
  const cameraApi = useShowroom((s) => s.cameraApi);
  const openModal = useShowroom((s) => s.openModal);

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <p className="hud-label mr-1">Camera</p>

      <div className="glass-panel flex w-[186px] flex-col overflow-hidden">
        {cameraPresets.map((preset) => {
          const isActive = preset.id === cameraPresetId;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => cameraApi?.goTo(preset.id)}
              aria-pressed={isActive}
              className={cn(
                "group relative flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-300",
                "border-b border-white/6 last:border-b-0",
                isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.025]",
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.span
                  layoutId="camera-active"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-y-0 left-0 w-[2px]"
                  style={{ background: accent }}
                />
              )}

              <Video
                className={cn(
                  "h-3 w-3 shrink-0 transition-colors",
                  isActive
                    ? "text-white/80"
                    : "text-white/25 group-hover:text-white/50",
                )}
                strokeWidth={1.5}
              />

              <span className="flex flex-col leading-none">
                <span
                  className={cn(
                    "font-display text-[10px] uppercase tracking-wide2 transition-colors",
                    isActive
                      ? "text-titanium"
                      : "text-white/55 group-hover:text-white/80",
                  )}
                >
                  {preset.label}
                </span>
                <span className="mt-1 font-mono text-[8px] uppercase tracking-wide2 text-white/25">
                  {preset.descriptor}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick action under the rail */}
      <button
        type="button"
        onClick={() => openModal("test-drive")}
        className="sweep group mt-1 flex items-center gap-2 border-white/10 px-3.5 py-2.5 font-mono text-[9px] uppercase tracking-wide2 text-white/50 transition-all duration-300 hover:border-white/30 hover:text-titanium"
      >
        <span className="relative z-10">Schedule viewing</span>
      </button>
    </div>
  );
}
