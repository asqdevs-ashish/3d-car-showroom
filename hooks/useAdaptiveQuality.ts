"use client";

import { create } from "zustand";

/**
 * Adaptive quality tiers for the showroom.
 *
 * The scene is authored to look its best (high tier). <PerformanceMonitor>
 * in ShowroomCanvas measures real frame time and steps this down when a
 * device cannot hold it — budget phones, integrated GPUs, thermally throttled
 * laptops — then steps it back up if the device recovers.
 *
 * Keeping the tier in a store rather than local state means the floor, the
 * lighting rig, the car model and the post-processing stack all read the SAME
 * value in the same render pass. Passing it down as props would let one
 * subtree update a frame late, which shows up as a shadow popping in or the
 * reflector briefly rendering at the wrong resolution.
 */
export type QualityTier = "high" | "medium" | "low";

export interface QualitySettings {
  /** Which tier this preset belongs to. */
  tier: QualityTier;
  /** Human label for the HUD's quality readout. */
  label: string;
  /** [min, max] device pixel ratio for the R3F canvas. */
  dpr: [number, number];
  /** Shadow map resolution per light. */
  shadowMapSize: number;
  /** Whether the directional key light casts shadows at all. */
  shadowsEnabled: boolean;
  /** MeshReflectorMaterial resolution. */
  reflectorResolution: number;
  /** Reflection strength — the cheapest lever on the reflector. */
  reflectorMixStrength: number;
  /** Floor micro-distortion; disabled below high. */
  reflectorDistortion: number;
  /** ContactShadows resolution. */
  contactShadowResolution: number;
  /** ContactShadows update strategy: Infinity = every frame. */
  contactShadowFrames: number;
  /** Full post-processing stack (Bloom + DOF + CA + Vignette + Noise). */
  postProcessing: boolean;
  /** Number of Environment lightformer accent panels. */
  environmentResolution: number;
  /** Whether the fine floor grid is drawn. */
  floorGrid: boolean;
  /** Antialias the WebGL context (costly on mobile GPUs). */
  antialias: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    tier: "high",
    label: "Ultra",
    /*
     * 1.5 is a hard ceiling, never 2. A 4K phone screen at dpr 2 renders
     * 4× the pixels of dpr 1; on a phone that is the single fastest route to
     * thermal throttling, and the visual gain above 1.5 is imperceptible on
     * a handheld display.
     */
    dpr: [1, 1.5],
    shadowMapSize: 2048,
    shadowsEnabled: true,
    reflectorResolution: 1024,
    reflectorMixStrength: 28,
    reflectorDistortion: 0.35,
    contactShadowResolution: 1024,
    contactShadowFrames: Infinity,
    postProcessing: true,
    environmentResolution: 256,
    floorGrid: true,
    antialias: true,
  },
  medium: {
    tier: "medium",
    label: "Balanced",
    dpr: [1, 1.25],
    shadowMapSize: 1024,
    shadowsEnabled: true,
    reflectorResolution: 512,
    reflectorMixStrength: 20,
    reflectorDistortion: 0.15,
    contactShadowResolution: 512,
    contactShadowFrames: Infinity,
    // Post FX is the most expensive single feature; it is the first to go.
    postProcessing: false,
    environmentResolution: 128,
    floorGrid: true,
    antialias: true,
  },
  low: {
    tier: "low",
    label: "Performance",
    dpr: [0.75, 1],
    shadowMapSize: 512,
    // Real-time shadows off entirely; ContactShadows still grounds the car.
    shadowsEnabled: false,
    reflectorResolution: 256,
    reflectorMixStrength: 14,
    reflectorDistortion: 0,
    contactShadowResolution: 256,
    // Bake once instead of every frame — a big win on a weak GPU.
    contactShadowFrames: 1,
    postProcessing: false,
    environmentResolution: 64,
    floorGrid: false,
    antialias: false,
  },
};

interface QualityState {
  tier: QualityTier;
  settings: QualitySettings;
  /** True once a downgrade has happened, so we never bounce back up forever. */
  hasDegraded: boolean;
  setTier: (tier: QualityTier) => void;
  /** Move one step down. No-op at the floor. */
  degrade: () => void;
  /** Move one step up. No-op at the ceiling. */
  upgrade: () => void;
  /**
   * `manual` means the user pinned a tier in the HUD, so PerformanceMonitor
   * must stop overriding their choice.
   */
  manual: boolean;
  setManual: (value: boolean) => void;
}

const ORDER: QualityTier[] = ["low", "medium", "high"];

export const useQuality = create<QualityState>((set, get) => ({
  tier: "high",
  settings: QUALITY_PRESETS.high,
  hasDegraded: false,
  manual: false,

  setTier: (tier) => set({ tier, settings: QUALITY_PRESETS[tier] }),

  degrade: () => {
    const { tier, manual } = get();
    if (manual) return;
    const index = ORDER.indexOf(tier);
    if (index <= 0) return;
    const next = ORDER[index - 1];
    set({ tier: next, settings: QUALITY_PRESETS[next], hasDegraded: true });
  },

  upgrade: () => {
    const { tier, manual } = get();
    if (manual) return;
    const index = ORDER.indexOf(tier);
    if (index >= ORDER.length - 1) return;
    const next = ORDER[index + 1];
    set({ tier: next, settings: QUALITY_PRESETS[next] });
  },

  setManual: (value) => set({ manual: value }),
}));
