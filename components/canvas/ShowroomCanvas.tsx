"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  MeshReflectorMaterial,
  PerformanceMonitor,
  Preload,
} from "@react-three/drei";
import * as THREE from "three";

import { getCarById, cars } from "@/config/cars";
import { useShowroom } from "@/hooks/useShowroomStore";
import { useIsLowPower } from "@/hooks/useMediaQuery";
import { useQuality, type QualitySettings } from "@/hooks/useAdaptiveQuality";
import { cameraPresets, getResponsivePreset } from "@/config/camera";
import { CameraRig } from "./CameraRig";
import { CarModel, preloadCarModel } from "./CarModel";
import { StudioLighting } from "./StudioLighting";
import { StudioBackdrop } from "./StudioBackdrop";
import { StudioPostProcessing } from "./StudioPostProcessing";

/* ------------------------------------------------------------------ */
/* Studio floor                                                        */
/* ------------------------------------------------------------------ */

interface StudioFloorProps {
  quality: QualitySettings;
}

/**
 * Polished resin studio floor.
 *
 * MeshReflectorMaterial renders the whole scene a second time into a render
 * target, so it is the single most expensive object here. Every one of its
 * knobs is driven by the adaptive quality tier.
 */
function StudioFloor({ quality }: StudioFloorProps) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <MeshReflectorMaterial
        /* Base resin colour reads almost black with a faint slate lift */
        color="#0b0b0f"
        resolution={quality.reflectorResolution}
        mixBlur={quality.tier === "low" ? 2 : 6}
        mixStrength={quality.reflectorMixStrength}
        /* Blur the reflection on the vertical axis so long highlights streak */
        blur={[
          quality.reflectorResolution,
          Math.round(quality.reflectorResolution / 4),
        ]}
        /* Micro-wobble: the floor is polished, not a perfect mirror */
        distortion={quality.reflectorDistortion}
        distortionMap={undefined}
        mirror={quality.tier === "low" ? 0.5 : 0.78}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        depthScale={1.1}
        depthToBlurRatioBias={0.28}
        roughness={0.86}
        metalness={0.42}
      />
    </mesh>
  );
}

/** Faint inlaid grid — the atelier's alignment markings under the car. */
function FloorGrid() {
  return (
    <gridHelper
      args={[40, 40, "#1c1c24", "#121218"]}
      position={[0, 0.002, 0]}
      material-transparent
      material-opacity={0.34}
    />
  );
}

/** A circular seam of cool light ringing the display position. */
function DisplayRing({ accent }: { accent: string }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      }),
    [accent],
  );

  // Release the previous material whenever the accent colour changes.
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <ringGeometry args={[4.55, 4.6, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Backdrop shell — keeps the horizon dark and seamless at any FOV. */
function Backdrop() {
  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[38, 32, 32]} />
      <meshBasicMaterial
        color="#050507"
        side={THREE.BackSide}
        fog={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Background model preloading                                         */
/* ------------------------------------------------------------------ */

/**
 * Warms the models the user is most likely to open next, into drei's cache.
 *
 * This deliberately does NOT preload the whole fleet any more.
 *
 * The original version queued all 14 GLBs. That was tolerable at the time
 * because the models were assumed small, but at 243 MB it meant the browser
 * spent minutes pulling the entire fleet in the background — competing with
 * the hero car for bandwidth, saturating memory, and making every interaction
 * feel sluggish on a weak device. The fleet is now 64 MB, but 64 MB of
 * speculative download is still 64 MB the user did not ask for, on a
 * connection that may be metered.
 *
 * Strategy now:
 *   • the NEXT and PREVIOUS car in the current filter are warmed, because
 *     those are reachable with one click and must feel instant
 *   • everything else loads on demand, with a glass loader in the viewport
 *
 * The deck already calls `preloadCarModel` on hover/focus, so exploratory
 * browsing warms models for free without any speculative download at all.
 */
function BackgroundPreloader({ enabled }: { enabled: boolean }) {
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const categoryFilter = useShowroom((s) => s.categoryFilter);

  useEffect(() => {
    if (!enabled) return;

    const pool =
      categoryFilter === "all"
        ? cars
        : cars.filter((c) => c.category === categoryFilter);
    if (pool.length < 2) return;

    const index = pool.findIndex((c) => c.id === selectedCarId);
    if (index === -1) return;

    const neighbours = [
      pool[(index + 1) % pool.length],
      pool[(index - 1 + pool.length) % pool.length],
    ];

    /*
     * Deferred so it lands after the hero car has settled and the entry
     * curtain is gone — starting during the first paint is what pushed the
     * loader from seconds into tens of seconds in earlier testing.
     */
    const id = window.setTimeout(() => {
      neighbours.forEach((car) => preloadCarModel(car.modelPath));
    }, 2500);

    return () => window.clearTimeout(id);
  }, [enabled, selectedCarId, categoryFilter]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Responsive camera framing                                           */
/* ------------------------------------------------------------------ */

/**
 * Keeps the camera framing matched to the viewport.
 *
 * This has TWO jobs, and the first one was missing:
 *
 *   1. ASPECT. `camera.aspect` must equal the canvas's width/height or the
 *      projection squashes the whole scene into a strip. R3F updates this on
 *      resize in most setups, but only when it owns the camera's update cycle;
 *      the scene here mutates the camera directly (GSAP tweens the position,
 *      this effect tweaks the fov), so nothing was keeping `aspect` in sync.
 *      A stale aspect is exactly what produced a narrow letterboxed render.
 *
 *   2. FOV. A long car in a narrow window overflows the frustum at a fixed
 *      34°, so the lens widens as the viewport narrows — what a photographer
 *      does: step back and go wider.
 */
function ResponsiveFraming() {
  const { camera, size } = useThree();
  const presetId = useShowroom((s) => s.cameraPresetId);
  const isAnimating = useShowroom((s) => s.isCameraAnimating);

  /*
   * ASPECT — kept in sync on every size change, unconditionally.
   *
   * Deliberately its own effect, not folded into the fov one below: the fov
   * effect bails out early while a camera tween is running, and the aspect
   * must be corrected even then.
   */
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (size.height <= 0) return;

    const aspect = size.width / size.height;
    if (Math.abs(camera.aspect - aspect) > 0.001) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (size.height <= 0) return;

    const preset = getResponsivePreset(presetId, size.width);
    const aspect = size.width / size.height;

    /*
     * Portrait needs a wider lens. Widen by up to 14° as the aspect drops
     * toward 1, so a phone in portrait still fits a 4.6m car end to end
     * without the barrel distortion a very wide lens would introduce.
     */
    const narrowness = Math.max(0, 1 - aspect);
    const extraFov = Math.min(14, narrowness * 26);
    const targetFov = (preset.fov ?? 34) + extraFov;

    /*
     * FOV is applied even during a camera tween. A GSAP move changes position
     * and target, not the lens, so there is nothing to fight — and skipping it
     * while animating left the fov stale after a resize mid-transition.
     */
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
    // `isAnimating` intentionally not a dependency — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, size.width, size.height, presetId]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Scene composition                                                   */
/* ------------------------------------------------------------------ */

function ShowroomScene() {
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const paintColor = useShowroom((s) => s.paintColor);
  const quality = useQuality((s) => s.settings);

  const car = useMemo(() => getCarById(selectedCarId), [selectedCarId]);
  const paint = useMemo(
    () =>
      car.colors.find(
        (c) => c.hex.toLowerCase() === paintColor.toLowerCase(),
      ) ?? car.colors[0],
    [car, paintColor],
  );

  return (
    <>
      {/* --- Atmosphere --- */}
      <color attach="background" args={["#07070a"]} />
      {/*
       * Fog fades the far floor into the backdrop. It starts at 30 so the car
       * and its immediate reflection are never tinted, and ends at 62 — beyond
       * the cyclorama wall, so the wall reads as atmosphere rather than a
       * visible object edge.
       */}
      <fog attach="fog" args={["#07070a", 30, 62]} />
      <Backdrop />

      {/* --- Studio environment behind the car --- */}
      <StudioBackdrop accent={car.signature} quality={quality} />

      {/* --- Lighting rig --- */}
      <StudioLighting quality={quality} />

      {/* --- Floor: reflector + grid + accent ring --- */}
      <StudioFloor quality={quality} />
      {quality.floorGrid && <FloorGrid />}
      <DisplayRing accent={car.signature} />

      {/* Soft ambient occlusion pooling directly under the car */}
      <ContactShadows
        position={[0, 0.012, 0]}
        opacity={0.86}
        scale={16}
        blur={quality.tier === "low" ? 1.4 : 2.6}
        far={5.2}
        resolution={quality.contactShadowResolution}
        color="#000"
        /* `frames={1}` bakes the shadow once — a large win on weak GPUs. */
        frames={quality.contactShadowFrames}
      />

      {/* --- The car --- */}
      <CarModel car={car} paint={paint} color={paintColor} />

      {/* --- Warm the rest of the fleet once the hero car has settled --- */}
      <BackgroundPreloader enabled={quality.tier !== "low"} />

      {/* --- Post FX (conditional on the tier) --- */}
      <StudioPostProcessing enabled={quality.postProcessing} />

      <Preload all />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Adaptive quality controller                                         */
/* ------------------------------------------------------------------ */

/**
 * Watches real frame time and steps the quality tier.
 *
 * Thresholds are deliberately asymmetric: we degrade on sustained decline but
 * only climb back when the device is genuinely comfortable. If both used the
 * same threshold the scene would oscillate between tiers every few frames,
 * which reads as flickering shadows and popping reflections.
 *
 * IMPORTANT — why `factor` and `step` are pinned:
 *
 * drei's PerformanceMonitor will, by default, also scale the renderer's DPR
 * up and down on its own. During the first seconds of a session frame times
 * are at their worst (shader compilation, first texture upload, decode), so it
 * would immediately drop to a fraction of full resolution and only climb back
 * once the scene settled — which is precisely the "car stays blurry for 3-5
 * seconds then sharpens" behaviour.
 *
 * We drive all quality changes through our own tier system instead, and keep
 * `factor`/`step` at 1 so the monitor can only report, never silently
 * re-resolve the canvas.
 */
function AdaptiveQualityController() {
  const degrade = useQuality((s) => s.degrade);
  const upgrade = useQuality((s) => s.upgrade);
  const hasDegraded = useQuality((s) => s.hasDegraded);
  const tier = useQuality((s) => s.tier);
  const flipflops = useRef(0);
  const lastTier = useRef(tier);

  /*
   * Grace period.
   *
   * The first render of a new model is always slow — decode, upload, shader
   * compile. Measuring during that window would downgrade quality on every
   * car switch, so we ignore samples for the first few seconds and only trust
   * a device's steady-state performance.
   */
  const startedAt = useRef(Date.now());
  const GRACE_MS = 5000;

  useEffect(() => {
    if (lastTier.current !== tier) {
      flipflops.current += 1;
      lastTier.current = tier;
    }
  }, [tier]);

  return (
    <PerformanceMonitor
      /* Sample over ~1s so a single slow frame (a shader compile, a GC pause)
         cannot trigger a downgrade on its own. */
      ms={1000}
      iterations={3}
      threshold={0.75}
      /* Pin the built-in DPR scaler off — see the note above. */
      factor={1}
      step={1}
      flipflops={3}
      onDecline={() => {
        if (Date.now() - startedAt.current < GRACE_MS) return;
        degrade();
      }}
      onIncline={() => {
        /*
         * Once we have degraded, only climb back if things are genuinely
         * smooth — and stop entirely if the device keeps oscillating between
         * two tiers, which would be visible as popping.
         */
        if (hasDegraded && flipflops.current > 3) return;
        upgrade();
      }}
      onFallback={() => degrade()}
    >
      {/* PerformanceMonitor requires children to render. */}
      <group />
    </PerformanceMonitor>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

/** Stops native mobile scroll/zoom while the user is rotating the car. */
function useCanvasTouchLock(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * OrbitControls calls preventDefault on the pointer events it consumes,
     * but on mobile Safari a gesture can still scroll the page underneath the
     * canvas. This catches what the controls do not.
     */
    const stop = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };

    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [ref]);
}

/**
 * The showroom WebGL surface.
 *
 * Mounted once and kept alive across all car switches — the R3F tree is
 * never torn down, so changing cars is a state change, not a reload.
 */
export function ShowroomCanvas() {
  const lowPowerDevice = useIsLowPower();
  const settings = useQuality((s) => s.settings);
  const setTier = useQuality((s) => s.setTier);
  const containerRef = useRef<HTMLDivElement>(null);

  useCanvasTouchLock(containerRef);

  /*
   * Seed the starting tier from the device class. A coarse-pointer phone
   * should not have to stutter for a second before PerformanceMonitor
   * notices — we can tell it is weak up front and open at `medium`.
   */
  useEffect(() => {
    if (lowPowerDevice) setTier("medium");
  }, [lowPowerDevice, setTier]);

  return (
    <div
      ref={containerRef}
      /* touch-action / user-select come from .canvas-container in globals.css */
      className="canvas-container absolute inset-0 z-0 h-full w-full"
      /* The canvas is decorative; the HUD above carries the semantics. */
      aria-hidden="true"
    >
      <Canvas
        // `demand` would kill the idle turntable; we want continuous but cheap.
        frameloop="always"
        dpr={settings.dpr}
        shadows={settings.shadowsEnabled ? "soft" : false}
        gl={{
          antialias: settings.antialias,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          failIfMajorPerformanceCaveat: false,
        }}
        camera={{
          position: cameraPresets[0].position,
          fov: cameraPresets[0].fov ?? 34,
          near: 0.1,
          far: 120,
        }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.85;
          gl.outputColorSpace = THREE.SRGBColorSpace;

          /* Recover gracefully instead of leaving a dead canvas forever. */
          gl.domElement.addEventListener(
            "webglcontextlost",
            (event) => {
              event.preventDefault();
              if (process.env.NODE_ENV !== "production") {
                console.warn(
                  "[A Square Devs Cars] WebGL context lost — dropping to low quality.",
                );
              }
              setTier("low");
            },
            false,
          );
        }}
        onPointerMissed={() => useShowroom.getState().clearActiveHotspot()}
        className="!h-full !w-full"
      >
        <AdaptiveQualityController />

        <Suspense fallback={null}>
          <ShowroomScene />
          <CameraRig />
          <ResponsiveFraming />
        </Suspense>
      </Canvas>
    </div>
  );
}
