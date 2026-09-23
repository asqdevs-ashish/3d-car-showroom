"use client";

import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { useMemo } from "react";

interface StudioPostProcessingProps {
  /** Disabled entirely on mobile / low-power devices. */
  enabled: boolean;
}

/**
 * The cinematic grade.
 *
 * Order matters in a composer: DOF softens first, bloom lifts the emissive
 * LED signatures, then CA + vignette + grain sit on top like a film scan.
 * Every effect is dialled well below "look at me" so the result reads as a
 * photograph rather than a filter.
 */
export function StudioPostProcessing({ enabled }: StudioPostProcessingProps) {
  const caOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0006), []);

  if (!enabled) return null;

  return (
    /*
     * Effect order is load-bearing:
     *   1. DOF      — shallow focus across the bodywork
     *   2. Bloom    — lifts the emissive headlight blades / tail bar
     *   3. CA       — very light lens fringing
     *   4. Vignette — corner falloff keeps the eye on the car
     *   5. Noise    — film grain stops flat gradients from banding
     */
    <EffectComposer multisampling={0}>
      <DepthOfField
        focusDistance={0.02}
        focalLength={0.06}
        bokehScale={1.8}
        height={480}
      />
      <Bloom
        intensity={0.32}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.5}
        mipmapBlur
        kernelSize={KernelSize.MEDIUM}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={caOffset}
        radialModulation={true}
        modulationOffset={0.35}
      />
      <Vignette eskil={false} offset={0.28} darkness={0.72} />
      <Noise
        premultiply
        blendFunction={BlendFunction.OVERLAY}
        opacity={0.028}
      />
    </EffectComposer>
  );
}
