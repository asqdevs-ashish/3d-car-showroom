"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import type { QualitySettings } from "@/hooks/useAdaptiveQuality";

interface StudioBackdropProps {
  accent: string;
  quality: QualitySettings;
}

/**
 * The showroom backdrop — a layered studio environment behind the car.
 *
 * Previously the scene was a single black sphere, which left the car floating
 * in an unlit void: no horizon, no depth cue, nothing for the rim light to
 * read against. This builds an actual photographic backdrop out of geometry,
 * nothing downloaded:
 *
 *   1. CYCLORAMA — the smooth curved wall a real studio shoots against. It
 *      wraps the floor into the wall with no corner, so the reflection seam
 *      disappears and the car appears to sit in a space rather than on a
 *      floating plane.
 *   2. HORIZON GLOW — a broad vertical gradient behind the car. This is the
 *      single most valuable piece: it separates the car's silhouette from the
 *      background, which is what makes a dark car legible at all.
 *   3. ATMOSPHERIC PANELS — subtle vertical light bars, like a modern
 *      showroom's illuminated wall. They give depth parallax as the camera
 *      orbits and a sense of scale.
 *   4. GROUND HAZE — a soft radial pool of light on the floor, so the car sits
 *      in a lit area with falloff rather than on a uniform mirror.
 *
 * Every layer is a cheap unlit mesh. There is no texture and no extra render
 * pass, so this costs a handful of draw calls rather than a second scene.
 */
export function StudioBackdrop({ accent, quality }: StudioBackdropProps) {
  const glowRef = useRef<THREE.Mesh>(null);

  const reduced = quality.tier === "low";

  /* --- Cyclorama: floor curving up into the back wall ------------------ */
  /*
   * Built from a cylinder open at the front so the camera always sees the
   * inside of the sweep. A `thetaLength` under 2π leaves a gap behind the
   * camera position, which is never visible but cuts the geometry cost.
   */
  const cycloramaGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        34,
        34,
        30,
        reduced ? 24 : 56,
        1,
        true,
        Math.PI * 0.3,
        Math.PI * 1.4,
      ),
    [reduced],
  );

  /*
   * Sky dome gradient, generated on a canvas.
   *
   * Five stops rather than the two this started with: the extra bands are what
   * create the sense of atmosphere. A dark zenith, a lifted horizon tinted by
   * the car's signature colour, then a quick falloff into the floor. It is an
   * 8x512 image, so the cost is nil — and unlike a shipped PNG it can never
   * fall out of sync with the palette.
   */
  const skyTexture = useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const g = ctx.createLinearGradient(0, 0, 0, 512);
    // Canvas y=0 is the TOP of the texture, which maps to the dome's zenith.
    g.addColorStop(0.0, "#040406");
    g.addColorStop(0.34, "#07080d");
    g.addColorStop(0.46, "#101520");
    // The horizon band — brightest, tinted by the car's own accent colour so
    // the backdrop subtly responds to whichever vehicle is on stage.
    g.addColorStop(0.5, hexWithAlpha(accent, 0.22));
    g.addColorStop(0.55, "#141821");
    g.addColorStop(0.68, "#0a0c12");
    g.addColorStop(1.0, "#050507");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [accent]);

  /*
   * Distant skyline.
   *
   * Seeded rather than `Math.random()` on purpose: a random layout differs
   * between the server render and the client, so the buildings would visibly
   * jump on hydration. A fixed seed keeps it identical everywhere.
   *
   * Three depth bands recede into the distance. Each is further away, wider,
   * taller and dimmer — standard atmospheric perspective, which the eye reads
   * as real distance without any fog on the backdrop itself. As the camera
   * orbits, near blocks slide against far ones and the parallax supplies the
   * depth cue the scene was previously missing entirely.
   */
  const skyline = useMemo(() => {
    let seed = 20240611;
    // Mulberry32 — tiny, fast, and good enough for placing rectangles.
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const towers: { x: number; z: number; w: number; h: number; lit: boolean }[] =
      [];

    const bands = reduced
      ? [{ z: -30, count: 8, hMin: 6, hMax: 16, wMin: 1.4, wMax: 2.8 }]
      : [
          { z: -26, count: 11, hMin: 5, hMax: 13, wMin: 1.0, wMax: 2.2 },
          { z: -38, count: 13, hMin: 8, hMax: 22, wMin: 1.6, wMax: 3.4 },
          { z: -52, count: 15, hMin: 10, hMax: 30, wMin: 2.2, wMax: 4.6 },
        ];

    bands.forEach((band, bandIndex) => {
      const spread = 60 + bandIndex * 16;
      for (let i = 0; i < band.count; i++) {
        towers.push({
          x: -spread / 2 + (i / (band.count - 1)) * spread + (rand() - 0.5) * 3,
          z: band.z + (rand() - 0.5) * 5,
          w: band.wMin + rand() * (band.wMax - band.wMin),
          h: band.hMin + rand() * (band.hMax - band.hMin),
          // Roughly one in three reads as an accent-lit tower.
          lit: rand() > 0.66,
        });
      }
    });

    return towers;
  }, [reduced]);

  /* --- Slow drift so the backdrop never looks like a still photograph --- */
  useFrame(({ clock }) => {
    if (reduced || !glowRef.current) return;
    const t = clock.getElapsedTime();
    const mat = glowRef.current.material as THREE.MeshBasicMaterial;
    // Very slight luminance breathing — motion without distraction.
    mat.opacity = 0.9 + Math.sin(t * 0.22) * 0.05;
  });

  return (
    <group>
      {/* ============ 1. Sky dome ============ */}
      {/* `scale={[-1,1,1]}` flips the sphere so the gradient faces inward. */}
      {skyTexture && (
        <mesh ref={glowRef} scale={[-1, 1, 1]}>
          <sphereGeometry args={[58, reduced ? 20 : 40, reduced ? 14 : 28]} />
          <meshBasicMaterial
            map={skyTexture}
            side={THREE.BackSide}
            /*
             * Fog is disabled on the backdrop on purpose. The scene fog is
             * tuned for the car and floor; letting it also eat the dome would
             * crush the gradient to flat black and undo the whole point.
             */
            fog={false}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ============ 2. Cyclorama wall ============ */}
      <mesh geometry={cycloramaGeometry} position={[0, 10, 0]}>
        <meshBasicMaterial
          color="#0a0b10"
          side={THREE.BackSide}
          fog={false}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* ============ 3. Distant skyline ============ */}
      {skyline.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2 - 1, t.z]}>
          <boxGeometry args={[t.w, t.h, t.w]} />
          <meshBasicMaterial
            color={t.lit ? hexWithAlpha(accent, 0.5) : "#131722"}
            transparent
            opacity={t.lit ? 0.4 : 0.65}
            fog={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ============ 4. Illuminated wall panels ============ */}
      {/*
       * Vertical strips flanking the display position. At `low` we draw two
       * instead of six — they are the most expendable layer, and the depth cue
       * still reads with a single pair.
       */}
      {(reduced ? [-9, 9] : [-16, -11.5, -7, 7, 11.5, 16]).map((x, index) => {
        const isAccent = index % 2 === 0;
        return (
          <mesh key={`${x}-${index}`} position={[x, 6, -18]}>
            <planeGeometry args={[isAccent ? 0.14 : 0.08, 15]} />
            <meshBasicMaterial
              color={isAccent ? accent : "#3d4454"}
              transparent
              opacity={isAccent ? 0.45 : 0.28}
              fog={false}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* ============ 5. Ground haze ============ */}
      {/*
       * A soft pool under the car. Additive blending so it lifts the floor
       * into a lit area without darkening anything — which is what a real
       * overhead softbox does to a polished floor.
       */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[10, reduced ? 24 : 56]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Warm counter-pool, offset from the car so the light reads as two
          sources rather than one symmetrical wash. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.006, 3]}>
        <circleGeometry args={[5.5, reduced ? 16 : 36]} />
        <meshBasicMaterial
          color="#d4af37"
          transparent
          opacity={0.035}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Convert `#rrggbb` to an `rgba()` string with the given alpha.
 *
 * Returns the input unchanged if it is not a 6-digit hex — the palette is all
 * hex today, but a bad value should degrade to a flat colour rather than throw
 * inside a render.
 */
function hexWithAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
