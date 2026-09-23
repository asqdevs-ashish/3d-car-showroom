"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { Center, Html, useGLTF, useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";

import type { Car, CarHotspot, CarPaint } from "@/config/cars";
import { useShowroom } from "@/hooks/useShowroomStore";
import { useQuality } from "@/hooks/useAdaptiveQuality";
import {
  applyPaint,
  computeFit,
  fitDimensions,
  resolvePaintTargets,
  TARGET_CAR_LENGTH,
  type PaintTargetReport,
} from "@/lib/modelInspect";
import { CarHotspotPin } from "./CarHotspotPin";

interface CarModelProps {
  car: Car;
  paint: CarPaint;
  color: string;
}

/*
 * DRACO DECODER PATH — MODULE SCOPE, ON PURPOSE.
 *
 * This MUST run before any loader is constructed. Placed inside the component
 * it had no effect: drei had already built its DRACOLoader with the default
 * CDN path (`/1.5.5/draco_wasm_wrapper.js`), so the decode failed even though
 * the request returned 200 — and every model in this fleet REQUIRES Draco, so
 * Suspense never resolved and the stage stayed empty.
 *
 * `/draco/` is our own copy, taken from three.js's `examples/jsm/libs/draco`,
 * so the decoder version matches the three.js runtime exactly.
 */
useGLTF.setDecoderPath("/draco/");

/* ------------------------------------------------------------------ */
/* Glassmorphic model loader (shown while a GLB streams in)            */
/* ------------------------------------------------------------------ */

/**
 * Rendered inside the R3F tree via drei's <Html>, so it appears in the 3D
 * viewport while a specific model is still downloading — distinct from the
 * full-page LuxuryLoader, which covers the initial app boot.
 */
function ModelSuspenseLoader({ label }: { label: string }) {
  const { progress } = useProgress();

  return (
    <Html center zIndexRange={[60, 0]} wrapperClass="pointer-events-none">
      <div className="glass-panel flex w-[220px] flex-col gap-3 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[8px] uppercase tracking-ultra text-white/45">
            Loading
          </span>
          <span className="font-display text-sm font-bold tabular-nums text-titanium">
            {Math.round(progress)}
            <span className="ml-0.5 font-mono text-[8px] font-normal text-white/35">
              %
            </span>
          </span>
        </div>

        <p className="truncate font-display text-[10px] uppercase tracking-wide2 text-titanium/80">
          {label}
        </p>

        {/* Hairline progress track */}
        <div className="relative h-px w-full bg-white/12">
          <div
            className="absolute inset-y-0 left-0 bg-gold transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Error boundary for a missing or corrupt GLB.
 *
 * Unlike the previous revision this renders NOTHING rather than a procedural
 * placeholder body — now that real models are present, a fake car appearing
 * on top of a load failure would be more misleading than an empty stage.
 * The failure is reported to the parent so the HUD can say so honestly.
 */
class ModelBoundary extends Component<
  { children: ReactNode; onFail: (reason: string) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    this.props.onFail(reason);

    /*
     * Also surfaced directly on the document, unconditionally.
     *
     * The HUD banner only renders for the SELECTED car, so a failure here for
     * a component that never got as far as rendering can be completely
     * invisible. Writing to the DOM guarantees the reason is readable during
     * diagnosis regardless of which car is on stage.
     */
    if (typeof document !== "undefined") {
      document.body.setAttribute("data-model-error", reason.slice(0, 300));
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[A Square Devs Cars] Model failed to load:", reason);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* The GLB sub-tree                                                    */
/* ------------------------------------------------------------------ */

interface GlbCarProps extends CarModelProps {
  onReport: (report: {
    paintTargets: PaintTargetReport;
    dimensions: { width: number; height: number; length: number };
    scale: number;
  }) => void;
  onFail: (reason: string) => void;
  /**
   * Fired once the model is decoded, fitted AND painted — i.e. the frame it
   * is genuinely safe to reveal. See the readiness comment in GlbCar.
   */
  onReady?: () => void;
}

function GlbCar({ car, paint, onReport, onFail, onReady }: GlbCarProps) {
  const quality = useQuality((s) => s.settings);
  /* Needed for `getMaxAnisotropy()` when configuring texture filtering. */
  const gl = useThree((s) => s.gl);
  /* Needed by the reveal diagnostic to report camera distance to the car. */
  const camera = useThree((s) => s.camera);

  const { scene } = useGLTF(car.modelPath, true);

  /*
   * Clone per-instance so switching cars never mutates the cached asset.
   *
   * `clone(true)` copies the node hierarchy but SHARES material instances
   * with the original in drei's cache. That is a real hazard: repainting —
   * or worse, disposing — a material here would silently corrupt every
   * future visit to this car. We therefore give each mesh its own material
   * copies, so the live configurator can only ever affect the car on stage.
   */
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    return clone;
  }, [scene]);

  /*
   * GPU MEMORY RELEASE ON SWITCH
   *
   * Each cloned model owns its own geometries and materials, so when this car
   * leaves the stage nothing else references them and they can be freed.
   * Without this, switching through the 14-car fleet accumulates every
   * mesh's buffers on the GPU until the driver kills the context — which is
   * exactly the context-loss crash that drops the showroom to a black canvas.
   *
   * Textures are disposed too, but only those this clone created. drei's cache
   * keeps its own copy of the source textures keyed by URL, so freeing ours
   * does not break a later visit to the same car — it re-clones from cache
   * and re-uploads. That is the correct trade: a small re-upload on return
   * instead of an unbounded leak while browsing.
   */
  useEffect(() => {
    return () => {
      const textures = new Set<THREE.Texture>();

      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;

        // Geometry buffers (positions, normals, UVs, indices).
        mesh.geometry?.dispose();

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        materials.forEach((mat) => {
          if (!mat) return;
          const m = mat as THREE.MeshStandardMaterial;

          // Collect every texture slot this material owns.
          [
            m.map,
            m.normalMap,
            m.roughnessMap,
            m.metalnessMap,
            m.aoMap,
            m.emissiveMap,
            m.alphaMap,
            (m as THREE.MeshPhysicalMaterial).clearcoatMap,
            (m as THREE.MeshPhysicalMaterial).clearcoatNormalMap,
            (m as THREE.MeshPhysicalMaterial).clearcoatRoughnessMap,
          ].forEach((tex) => {
            if (tex) textures.add(tex);
          });

          m.dispose();
        });
      });

      /*
       * Deduplicate before disposing. Models routinely share one texture
       * across many materials, and disposing the same object twice is a
       * wasted call at best and an invalid-GPU-object warning at worst.
       */
      textures.forEach((tex) => tex.dispose());
    };
  }, [model]);

  /*
   * AUTO-FIT — scales from the DECODED extent.
   *
   * The hard-won lesson here: the accessor min/max stored in a
   * `KHR_draco_mesh_compression` GLB is NOT the extent of the decoded mesh.
   * Draco keeps its own quantised bounds inside the extension, and the
   * accessor values are in a different space entirely. Measured directly:
   * the BMW's accessor says 5.77 units long, and the mesh that actually
   * decodes occupies 0.04 world units. Scaling by 4.6/5.77 gave a 4cm car.
   *
   * So we measure the decoded geometry. `GlbCar` only reaches this component
   * after `useGLTF` has resolved, which is precisely when the Draco buffers
   * are populated and `computeBoundingBox()` becomes trustworthy.
   *
   * A `useState` + effect is used rather than `useMemo` because the first
   * render happens before the geometry is guaranteed ready; the first frame
   * uses a neutral scale and the correct one lands immediately after.
   */
  const [fit, setFit] = useState(() => ({
    scale: 1,
    rawSize: new THREE.Vector3(TARGET_CAR_LENGTH, 1.2, TARGET_CAR_LENGTH),
    offset: new THREE.Vector3(),
    isMeasured: false,
  }))

  useEffect(() => {
    const result = computeFit(model)

    if (result.isMeasured) {
      setFit(result)
      return
    }

    /*
     * Not measurable yet. Retry on an interval rather than rAF: this
     * component re-renders continuously (the turntable runs in `useFrame`),
     * and a re-render cancels a pending rAF via the effect cleanup — which
     * silently killed the retry loop in an earlier revision.
     */
    let tries = 0
    const id = window.setInterval(() => {
      const next = computeFit(model)
      if (next.isMeasured) {
        setFit(next)
        window.clearInterval(id)
      } else if (++tries > 100) {
        window.clearInterval(id)
      }
    }, 50)

    return () => window.clearInterval(id)
  }, [model])

  const dimensions = useMemo(
    () => fitDimensions(fit.rawSize, fit.scale),
    [fit],
  );

  /* Clear the old diagnostic attribute now that measurement is deterministic. */
  useEffect(() => {
    document.body.removeAttribute("data-fit")
    document.body.removeAttribute("data-fit-debug")
  }, []);

  /*
   * NO PLACEHOLDER DETECTION.
   *
   * There used to be a heuristic here that flagged a model as "not a vehicle"
   * when its measured extent came in under 2.5 metres. It has been removed,
   * and the Koenigsegg model it was written for has been deleted from the
   * fleet entirely.
   *
   * It was a bad trade: `computeFit` needs the DECODED geometry to measure, so
   * between mount and decode the extent reads as ~0 — and a car that had not
   * finished decoding yet was indistinguishable from a genuinely tiny one. The
   * result was a "model unavailable" banner over cars that rendered perfectly.
   *
   * A size threshold is the wrong signal anyway. If a model is missing or
   * corrupt, `useGLTF` rejects and `ModelBoundary` reports it precisely.
   */

  /* --- Paint targets: resolved once per model ------------------------- */
  const paintTargets = useMemo(() => {
    try {
      return resolvePaintTargets(model, car, true);
    } catch (error) {
      /*
       * A paint-resolution failure is NOT a load failure.
       *
       * This used to call `onFail`, which set the HUD's "model unavailable"
       * banner — so a car that loaded perfectly and rendered perfectly still
       * showed an error, purely because its materials could not be matched for
       * the colour configurator. On the Chiron that made a working car look
       * broken.
       *
       * The two concerns are now separated: the model is reported healthy, and
       * only the (lesser) loss of paint customisation is noted, in dev.
       */
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[A Square Devs Cars] Paint targets unavailable on ${car.id}; ` +
            `the colour configurator will not affect it.`,
          error,
        );
      }
      return {
        materials: [],
        strategy: "none" as const,
        note: "resolution threw",
      };
    }
    // Intentionally keyed on model identity only — colour changes apply below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, car.id]);

  /* --- Shadows + material hygiene ------------------------------------- */
  useEffect(() => {
    /*
     * Shadow casting follows the adaptive tier. At `low` the renderer has
     * shadows disabled entirely, so flagging every mesh here would cost
     * per-frame work for nothing and can leave stale shadow entries.
     */
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = quality.shadowsEnabled;
      mesh.receiveShadow = true;
      // Frustum culling on cloned large meshes can pop them out of view at
      // the camera's extremes; these cars are always on screen.
      mesh.frustumCulled = false;

      /*
       * ANISOTROPIC FILTERING — the fix for the car looking blurry.
       *
       * Without this, three.js samples textures with a single mip level and
       * any surface seen at an angle (which is most of a car — the bonnet, the
       * roof, the flank) smears into a low-resolution blur. It is most obvious
       * immediately after load, because that is when the widest range of mip
       * levels is still being resolved, and it clears up over a few seconds as
       * the GPU settles on a level. Setting anisotropy removes the smearing
       * entirely and costs nothing measurable.
       *
       * Capped at 8: values above that show no visible improvement on car
       * paint but do cost real bandwidth on a weak GPU.
       */
      const anisotropy = Math.min(8, maxAnisotropy);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((mat) => {
        if (!mat) return;
        const m = mat as THREE.MeshStandardMaterial;
        [
          m.map,
          m.normalMap,
          m.roughnessMap,
          m.metalnessMap,
          m.aoMap,
          m.emissiveMap,
        ].forEach((tex) => {
          if (tex && tex.anisotropy !== anisotropy) {
            tex.anisotropy = anisotropy;
            tex.needsUpdate = true;
          }
        });
      });
    });
  }, [model, quality.shadowsEnabled, gl]);

  /* --- Repaint whenever the configurator colour changes ---------------- */
  useEffect(() => {
    if (paintTargets.materials.length === 0) return;
    applyPaint(paintTargets.materials, paint);
  }, [paint, paintTargets]);

  /* --- Report upward so the HUD can position hotspots ------------------ */
  useEffect(() => {
    onReport({ paintTargets, dimensions, scale: fit.scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintTargets, dimensions, fit.scale]);

  /*
   * Signal readiness — but only after the paint has actually been applied.
   *
   * This deliberately runs AFTER the repaint effect above so the car is never
   * revealed in its un-painted factory colour and then visibly recoloured a
   * frame later. It fires once per model; the ref guards against re-firing on
   * every subsequent configurator change.
   */
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;

    /*
     * Readiness requires a completed MEASUREMENT, not just a loaded file.
     *
     * The model is kept invisible until `fit.isMeasured` (see the render
     * below), so announcing before that would swap the stage to a car that is
     * still hidden — the user would watch the old car leave and an empty stage
     * arrive.
     *
     * NOT gated on `paintTargets.materials.length`. That used to be the guard,
     * and it was a deadlock: on a model where the paint resolver found no
     * target (the Porsche's `991_2phong*` materials are the obvious case),
     * `onReady` never fired, `readyCarId` never updated, and the car never
     * swapped at all. Paint customisation is a lesser concern than the car
     * being visible.
     */
    announced.current = true;

    /*
     * One frame later. Three.js uploads textures and compiles shaders lazily
     * on first draw, so announcing from inside this effect still lands before
     * the first render — and the swap would happen on a frame that then
     * stalls on that upload. Waiting a frame lets the upload happen while the
     * previous car is still covering the stage.
     */
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [onReady]);


  /*
   * `<Center top>` re-origins the model so its centre sits on X/Z and its BASE
   * sits at y=0. That is what the floor reflector needs: the contact patch
   * lands on the mirror plane regardless of where the author put the origin.
   *
   * Deliberately NEVER gated on a visibility flag. An earlier revision hid the
   * model until measurement completed, which deadlocked the render — the car
   * stayed invisible because it could not be measured, and could not be
   * measured because it was invisible.
   */
  /*
   * RENDER POSITION — derived from the SAME box as the scale, then divided by
   * the scale so the group's own transform applies it exactly once.
   *
   * `box.getCenter()` / `box.min` are WORLD-space values, and the node they
   * come from carries `scale`. The group below also applies that scale, so any
   * offset given to it is multiplied by it. Passing the raw centre therefore
   * under-shifts by a factor of 91 and the car sits metres off-centre.
   *
   * Dividing by the scale converts back to the group's local space, which is
   * what `position` expects.
   */
  const invScale = fit.scale !== 0 ? 1 / fit.scale : 1

  return (
    <group
      scale={fit.scale}
      position={[
        -fit.offset.x * invScale,
        -fit.offset.y * invScale,
        -fit.offset.z * invScale,
      ]}
    >
      <primitive object={model} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Hotspot placement                                                   */
/* ------------------------------------------------------------------ */

/**
 * Convert a ratio-based hotspot anchor into a world position.
 *
 * `anchor` is expressed as a fraction of the car's normalised bounding box:
 *   x: -0.5 = left flank, +0.5 = right flank
 *   y:  -0.5 = ground,     +0.5 = roof
 *   z:  -0.5 = tail,       +0.5 = nose
 *
 * Because <Center top> seats the car's base at y=0, the vertical axis maps
 * 0 → ground and 1 → full height, which is why y is offset by -0.5 here.
 */
function anchorToWorld(
  anchor: [number, number, number],
  dims: { width: number; height: number; length: number },
): [number, number, number] {
  return [
    anchor[0] * dims.width,
    (anchor[1] + 0.5) * dims.height,
    anchor[2] * TARGET_CAR_LENGTH,
  ];
}

/**
 * How long we are willing to hold the outgoing car on screen while the next
 * one decodes.
 *
 * Switching cars costs a Draco decode plus a GPU upload for a multi-megabyte
 * model, which measured as a single ~900 ms blocked frame. Rather than freeze
 * on a half-decoded mesh, the outgoing car stays rendered (dimmed) until the
 * incoming one reports ready, then swaps on one frame.
 *
 * The cap exists so a model that never loads (404, corrupt) cannot leave the
 * stage stuck on a stale car forever.
 */
const MAX_SWAP_WAIT_MS = 4000

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export function CarModel(props: CarModelProps) {
  const { car } = props;

  const groupRef = useRef<THREE.Group>(null);
  const activeHotspot = useShowroom((s) => s.activeHotspot);
  const setActiveHotspot = useShowroom((s) => s.setActiveHotspot);
  const clearActiveHotspot = useShowroom((s) => s.clearActiveHotspot);
  const setModelError = useShowroom((s) => s.setModelError);

  const [dimensions, setDimensions] = useState({
    width: 2,
    height: 1.2,
    length: TARGET_CAR_LENGTH,
  });
  const [paintNote, setPaintNote] = useState<string>("");

  /*
   * `car.id` of the model that has fully loaded and painted.
   *
   * The stage renders whichever car is in this state, NOT `props.car`
   * directly. That is what decouples "the user picked a car" from "the car can
   * be drawn", and it is what removes the freeze: the previous car stays on
   * screen until the new one is genuinely ready, so there is never a frame
   * where geometry exists but its materials do not.
   */
  const [readyCarId, setReadyCarId] = useState<string | null>(null);

  /*
   * True while a swap is in flight. Drives the dim so the user can see
   * something is happening instead of a frozen image.
   */
  const [isSwapping, setIsSwapping] = useState(false);

  /*
   * Safety valve.
   *
   * If the incoming model never reports ready (missing file, decode failure)
   * we must still show it, otherwise the stage displays the previous car
   * forever with no indication why. After MAX_SWAP_WAIT_MS we accept the new
   * car regardless and let the error boundary report any real failure.
   */
  useEffect(() => {
    if (readyCarId === car.id) return;

    const failsafe = window.setTimeout(
      () => setReadyCarId(car.id),
      MAX_SWAP_WAIT_MS,
    );
    return () => window.clearTimeout(failsafe);
  }, [car.id, readyCarId]);

  /*
   * The model finished decoding.
   *
   * Deliberately does NOT swap immediately — the phase effects below own the
   * timing so the exit animation always completes first.
   */
  const handleReady = useCallback(() => {
    setReadyCarId(car.id);
  }, [car.id]);

  /* --- Idle turntable: slow, and pauses while inspecting a hotspot ----- */
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group || activeHotspot) return;
    group.rotation.y += delta * 0.04;
  });

  const handleReport = useMemo(
    () =>
      ({
        paintTargets,
        dimensions: dims,
      }: {
        paintTargets: PaintTargetReport;
        dimensions: { width: number; height: number; length: number };
        scale: number;
      }) => {
        setDimensions(dims);
        setPaintNote(paintTargets.note);
        if (
          process.env.NODE_ENV !== "production" &&
          paintTargets.strategy === "none"
        ) {
          console.warn(
            `[A Square Devs Cars] No paint target on ${car.id}; colour changes will not be visible.`,
          );
        }
      },
    [car.id],
  );

  const handleFail = useMemo(
    () => (reason: string) => setModelError(car.id, reason),
    [car.id, setModelError],
  );

  /* Clear any stale error when the user moves to a different car. */
  useEffect(() => {
    setModelError(car.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.id]);

  const isActiveCar = activeHotspot?.carId === car.id;

  /*
   * CAR TRANSITION — three distinct phases.
   *
   * The previous approach kept the old car mounted and swapped the instant the
   * new one was ready, with no exit motion at all. Functionally correct (no
   * freeze) but it read badly: the old car simply vanished, and the new one
   * appeared already in place. There was no sense of one car leaving and
   * another arriving.
   *
   * Now:
   *
   *   PHASE 1 — EXITING   the outgoing model animates OUT (sinks and fades),
   *                       and the incoming model loads behind the curtain.
   *   PHASE 2 — SWAPPING  the moment the exit finishes the meshes are
   *                       exchanged, while the stage is at its darkest.
   *   PHASE 3 — ENTERING  the new model animates IN from below with the slow
   *                       turntable settling.
   *
   * The critical detail is that the decoder work happens DURING phase 1, while
   * the old car is still on screen and the renderer has real geometry. That is
   * what keeps the transition smooth instead of stalling.
   */
  const EXIT_MS = 380;

  const [phase, setPhase] = useState<"idle" | "exiting" | "entering">("idle");

  /* Kick off the exit as soon as a different car is selected. */
  /*
   * Kick off the exit ONLY when a different car has been requested.
   *
   * The guard is `readyCarId !== null`, not just `!== car.id`. On the very
   * first mount `readyCarId` is null and this fired anyway — immediately
   * animating the group DOWN and away (y: -0.55, z: 1.2) before the model had
   * even been seen. Nothing ever brought it back, because the `entering`
   * phase waits on a readiness signal that had already been consumed. The car
   * was mounted, animated off-screen, and left there.
   *
   * Null means "nothing has been shown yet", which is not a transition.
   */
  useEffect(() => {
    if (readyCarId === null) return;
    if (readyCarId === car.id) return;

    setPhase("exiting");
    setIsSwapping(true);
  }, [car.id, readyCarId]);

  /*
   * The exit animation itself. This drives the OUTGOING group, which is still
   * mounted with the previous car's geometry at this point.
   */
  useEffect(() => {
    if (phase !== "exiting") return;
    const group = groupRef.current;
    if (!group) return;

    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.rotation);

    gsap.to(group.position, {
      y: -0.55,
      z: 1.2,
      duration: EXIT_MS / 1000,
      ease: "power2.in",
    });
    gsap.to(group.rotation, {
      y: Math.PI * 0.16,
      duration: EXIT_MS / 1000,
      ease: "power2.in",
    });
  }, [phase]);

  /*
   * Phase 2 — SWAP, then phase 3 — ENTER.
   *
   * Once the model reports ready we hold for the exit duration so the outgoing
   * car's motion completes, then flip `showCurrent` and play the incoming car
   * in. Doing the swap and the enter in ONE effect (rather than two chained
   * ones keyed on different state) removes a whole class of timing races —
   * notably the case where `readyCarId` updated while the exit tween was still
   * running, unmounting the outgoing model mid-animation.
   */
  useEffect(() => {
    if (readyCarId !== car.id) return;

    const swapTimer = window.setTimeout(() => {
      setIsSwapping(false);
      setPhase("entering");
    }, EXIT_MS);

    return () => window.clearTimeout(swapTimer);
  }, [readyCarId, car.id]);

  /*
   * Phase 3 — ENTER.
   *
   * The `fromTo` is explicit rather than relying on the previous tween's end
   * state, so a fast double-switch cannot leave the car parked off-screen.
   */
  useEffect(() => {
    if (phase !== "entering") return;
    const group = groupRef.current;
    if (!group) return;

    gsap.killTweensOf(group.position);
    gsap.killTweensOf(group.rotation);

    gsap.fromTo(
      group.position,
      { y: -0.45, z: 1.3 },
      { y: 0, z: 0, duration: 1.1, ease: "power3.out" },
    );
    gsap.fromTo(
      group.rotation,
      { y: -Math.PI * 0.2 },
      { y: 0, duration: 1.45, ease: "power3.out" },
    );

    /* Back to idle so the next selection can start a fresh cycle. */
    const done = window.setTimeout(() => setPhase("idle"), 1500);
    return () => window.clearTimeout(done);
  }, [phase]);

  /*
   * DEADLOCK FIX — the car must mount BEFORE it can report readiness.
   *
   * `showCurrent` gates whether `GlbCar` is mounted at all. It was
   * `readyCarId === car.id`, and `readyCarId` only ever became `car.id` via
   * `GlbCar`'s `onReady` — which cannot fire if `GlbCar` is not mounted.
   * Chicken and egg: on first load `readyCarId` is `null`, so the `else`
   * branch rendered an empty group, `GlbCar` never mounted, `onReady` never
   * fired, and `readyCarId` stayed `null` forever. The stage was empty and no
   * error was ever raised.
   *
   * The incoming car now mounts unconditionally, and `showCurrent` only
   * controls the transition animation — which is what it was always meant to
   * do. The previous car is kept mounted alongside it during a swap (that is
   * `isSwapping`), so the stage is never empty mid-transition.
   */
  /*
   * Whether the CURRENT car should be mounted.
   *
   * True on first load (`readyCarId === null`) and whenever this car is the
   * ready one. Only a car that has been superseded is left unmounted.
   */
  const showCurrent = readyCarId === null || readyCarId === car.id;

  return (
    <group ref={groupRef}>
      {showCurrent ? (
        /*
         * key={car.id} forces a full remount per car so no material or
         * geometry from the previous model can survive into this one.
         */
        <ModelBoundary key={car.id} onFail={handleFail}>
          <Suspense
            fallback={<ModelSuspenseLoader label={`${car.brand} ${car.name}`} />}
          >
            <GlbCar
              {...props}
              onReport={handleReport}
              onFail={handleFail}
              onReady={handleReady}
            />
          </Suspense>
        </ModelBoundary>
      ) : (
        /*
         * Placeholder while the next car decodes.
         *
         * Deliberately empty rather than a stand-in shape: a grey box that
         * then snaps to a real car reads as a bug. A quiet, dimmed stage with
         * the loader visible reads as loading.
         */
        <group visible={false} />
      )}

      {/*
       * Hotspot pins. Anchored against the measured bounding box, so they
       * land correctly on every car regardless of authored scale.
       *
       * Hidden on placeholder models. The pin positions are derived from the
       * bounding box, so a unit-cube source produces a correctly-placed pin on
       * a shape that is not a car — which reads as a giant floating marker
       * stuck to a blob. Better to show nothing than something misleading.
       */}
      <group>
        {car.hotspots.map((hotspot) => (
          <CarHotspotPin
            key={hotspot.id}
            hotspot={hotspot}
            position={anchorToWorld(hotspot.anchor, dimensions)}
            accent={car.signature}
            isActive={isActiveCar && activeHotspot?.hotspotId === hotspot.id}
            onSelect={(h: CarHotspot) => {
              if (isActiveCar && activeHotspot?.hotspotId === h.id) {
                clearActiveHotspot();
              } else {
                setActiveHotspot(car.id, h.id);
              }
            }}
          />
        ))}
      </group>

      {/* Dev-only paint diagnostics, stripped from production builds. */}
      {process.env.NODE_ENV !== "production" && paintNote && (
        <Html
          position={[0, 0, 0]}
          zIndexRange={[1, 0]}
          wrapperClass="pointer-events-none"
        >
          <span className="hidden" data-paint-note={paintNote} />
        </Html>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Preloading                                                          */
/* ------------------------------------------------------------------ */

/**
 * Warm a model into drei's cache so selecting it swaps instantly.
 * Safe to call on hover/focus — it is a no-op once the URL is cached.
 */
export function preloadCarModel(path: string) {
  try {
    useGLTF.preload(path, true);
  } catch {
    // Missing asset: the boundary reports it when the car is actually shown.
  }
}

/** Warm several models at once, e.g. after the first car has settled. */
export function preloadCarModels(paths: string[]) {
  paths.forEach(preloadCarModel);
}
