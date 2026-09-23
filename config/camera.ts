import type { HotspotId } from "@/config/cars";

/**
 * Cinematic camera presets. Position/target are in world space and are
 * lerped by GSAP — never snapped — so every move reads as a dolly.
 */
export interface CameraPreset {
  id: string;
  label: string;
  /** Short mono descriptor shown in the camera rail tooltip. */
  descriptor: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export const cameraPresets: CameraPreset[] = [
  {
    id: "front",
    label: "Front Aggressive",
    descriptor: "LOW / WIDE",
    position: [0, 1.1, 9.4],
    target: [0, 0.85, 0],
    fov: 34,
  },
  {
    id: "side",
    label: "Side Profile",
    descriptor: "FLAT / FULL",
    position: [10.6, 1.15, 0],
    target: [0, 0.85, 0],
    fov: 32,
  },
  {
    id: "cockpit",
    label: "Cockpit Focus",
    descriptor: "MACRO / INT",
    position: [-2.1, 1.5, 2.6],
    target: [-0.35, 0.72, 0.1],
    fov: 42,
  },
  {
    id: "rear",
    label: "Rear Wing",
    descriptor: "HERO / LOW",
    position: [-4.2, 1.15, -7.6],
    target: [0, 0.75, -1.6],
    fov: 34,
  },
];

export const DEFAULT_CAMERA_PRESET = cameraPresets[0].id;

/* ------------------------------------------------------------------ */
/* Responsive framing                                                  */
/* ------------------------------------------------------------------ */

/** Breakpoint below which we treat the viewport as "small". */
export const MOBILE_BREAKPOINT = 768;

/**
 * Scales a preset for the current viewport width.
 *
 * On a phone the camera pulls back and the lens opens up so a 4.6m car fits
 * the frame end-to-end; on a large desktop display the preset is used as
 * authored. The interpolation is continuous rather than a hard breakpoint so
 * resizing a browser window never produces a visible jump.
 *
 * Returns a NEW preset object — callers must not mutate the shared table.
 */
export function getResponsivePreset(presetId: string, viewportWidth: number): CameraPreset {
  const base = cameraPresets.find((p) => p.id === presetId) ?? cameraPresets[0];

  // 1.0 at >=1280px, 0.0 at <=420px (a small phone in portrait).
  const t = Math.min(
    1,
    Math.max(0, (viewportWidth - 420) / (1280 - 420)),
  );
  const smallness = 1 - t;

  if (smallness <= 0) return base;

  /*
   * Pull back along the view axis (up to +38% distance) and widen the lens
   * (up to +12°). Both are needed: distance alone makes the car look flat,
   * FOV alone introduces perspective distortion on the bodywork.
   */
  const distanceScale = 1 + smallness * 0.38;
  const [tx, ty, tz] = base.target;
  const [px, py, pz] = base.position;

  return {
    ...base,
    position: [
      tx + (px - tx) * distanceScale,
      ty + (py - ty) * distanceScale,
      tz + (pz - tz) * distanceScale,
    ],
    fov: (base.fov ?? 34) + smallness * 12,
  };
}
export type HotspotFocus = {
  carId: string;
  hotspotId: HotspotId;
} | null;
