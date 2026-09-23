"use client";

import { Html } from "@react-three/drei";
import type { CarHotspot } from "@/config/cars";
import { cn } from "@/lib/cn";

interface CarHotspotPinProps {
  hotspot: CarHotspot;
  /**
   * World position, computed by CarModel from the measured bounding box.
   * Passed in rather than read from `hotspot.anchor` directly, because the
   * anchor is a RATIO that only means something once a model has been
   * measured and auto-fitted.
   */
  position: [number, number, number];
  isActive: boolean;
  accent: string;
  onSelect: (hotspot: CarHotspot) => void;
}

/**
 * An interactive annotation anchored in 3D space.
 *
 * The anchor is projected through the camera by drei's <Html>, but the pin
 * itself is DOM — which keeps it crisp at any DPR and lets it inherit the
 * same glass/mono type language as the rest of the HUD.
 *
 * `occlude` hides pins behind bodywork; `distanceFactor` scales them with
 * depth so they feel physically attached to the car.
 */
export function CarHotspotPin({
  hotspot,
  position,
  isActive,
  accent,
  onSelect,
}: CarHotspotPinProps) {
  return (
    <Html
      position={position}
      center
      distanceFactor={9}
      zIndexRange={[40, 0]}
      // Hide pins when the car body is between them and the camera.
      occlude
      wrapperClass="pointer-events-none"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(hotspot);
        }}
        className="group pointer-events-auto relative flex flex-col items-center outline-none"
        aria-label={`${hotspot.label}: ${hotspot.headline}`}
      >
        {/* Pulse ring — the "live telemetry" tell */}
        <span
          className="absolute h-7 w-7 rounded-full animate-pulse-ring"
          style={{
            border: `1px solid ${accent}`,
            opacity: isActive ? 0.9 : 0.5,
          }}
        />

        {/* Core dot */}
        <span
          className={cn(
            "relative flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-300",
            "backdrop-blur-md group-hover:scale-110",
            isActive ? "scale-110" : "scale-100",
          )}
          style={{
            borderColor: accent,
            background: isActive ? accent : "rgba(8,8,10,0.55)",
            boxShadow: `0 0 14px ${accent}${isActive ? "aa" : "55"}`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: isActive ? "#08080A" : accent }}
          />
        </span>

        {/* Label chip — fades up on hover or when active */}
        <span
          className={cn(
            "pointer-events-none mt-2 whitespace-nowrap rounded-full border px-2.5 py-1",
            "glass-panel font-mono text-[9px] uppercase tracking-wide2 text-white/80",
            "opacity-0 transition-all duration-300 group-hover:opacity-100",
            isActive && "opacity-100 translate-y-0",
          )}
        >
          {hotspot.label}
        </span>
      </button>
    </Html>
  );
}
