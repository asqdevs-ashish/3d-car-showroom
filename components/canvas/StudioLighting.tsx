"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

import type { QualitySettings } from "@/hooks/useAdaptiveQuality";

interface StudioLightingProps {
  /** Drives shadow map size, lightformer count and animated intensity. */
  quality: QualitySettings;
}

/**
 * A photographic-dark studio lighting rig.
 *
 * The car is lit the way a real showroom car is: a soft overhead softbox
 * grid for the broad highlight, two lateral "strip" boxes to draw the
 * shoulder line, a hard key for the front quarter, and a rim light behind
 * to peel the silhouette off the background.
 *
 * The environment is built from Lightformers rather than an HDRI so it is
 * fully art-directable here in code and ships with zero texture weight.
 */
export function StudioLighting({ quality }: StudioLightingProps) {
  const rimRef = useRef<THREE.SpotLight>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);

  /* Animate only on the top tier — a static frame is fine when GPU-bound. */
  const animated = quality.tier === "high";
  const reduced = quality.tier === "low";

  /* Very slow luminance drift on the rim so a static frame still feels alive. */
  useFrame(({ clock }) => {
    if (!animated) return;
    const t = clock.getElapsedTime();
    // Subtle breathing on the rim light only — the key stays rock steady so
    // the bodywork highlight doesn't visibly drift.
    if (rimRef.current) rimRef.current.intensity = 14 + Math.sin(t * 0.45) * 2.5;
  });

  return (
    <>
      {/* --- Base ambient: just enough to keep shadows from going pure black --- */}
      <ambientLight intensity={0.35} color="#8ea6c8" />

      {/* --- Key light, front-left three-quarter. Moderate, not hot: this is
             what separates the shoulder line, it should not wash the paint. --- */}
      <directionalLight
        ref={keyRef}
        position={[5.5, 7.5, 6] as unknown as THREE.Vector3}
        intensity={2.6}
        color="#ffffff"
        castShadow={quality.shadowsEnabled}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      {/* --- Overhead softbox bank: broad, soft, slightly cool --- */}
      <rectAreaLight
        position={[0, 6.2, 0.5] as unknown as THREE.Vector3}
        rotation={[-Math.PI / 2, 0, 0] as unknown as THREE.Euler}
        width={10}
        height={5}
        intensity={1.4}
        color="#ffffff"
      />

      {/* --- Lateral strips: these draw the contour down the flanks --- */}
      <rectAreaLight
        position={[6.5, 1.9, 0] as unknown as THREE.Vector3}
        rotation={[0, -Math.PI / 2, 0] as unknown as THREE.Euler}
        width={9}
        height={1.1}
        intensity={1.6}
        color="#eaf2ff"
      />
      <rectAreaLight
        position={[-6.5, 1.9, 0] as unknown as THREE.Vector3}
        rotation={[0, Math.PI / 2, 0] as unknown as THREE.Euler}
        width={9}
        height={1.1}
        intensity={1.1}
        color="#dbe6ff"
      />

      {/* --- Cyan rim from behind: separates the car from the dark floor.
             Kept well below the bloom threshold so it edge-lights the
             silhouette instead of flaring the whole rear of the car. --- */}
      <spotLight
        ref={rimRef}
        position={[-4.5, 3.4, -7] as unknown as THREE.Vector3}
        angle={0.75}
        penumbra={1}
        intensity={14}
        color="#00f0ff"
        distance={26}
      />

      {/* --- Warm gold fill from the rear-right: the "premium" bounce --- */}
      <spotLight
        position={[5.5, 2.4, -6] as unknown as THREE.Vector3}
        angle={0.8}
        penumbra={1}
        intensity={7}
        color="#d4af37"
        distance={24}
      />

      {/* --- Cool under-fill so the rocker panels never read as voids --- */}
      <pointLight
        position={[0, -1.2, 2] as unknown as THREE.Vector3}
        intensity={2.2}
        color="#1e3a5f"
        distance={12}
      />

      {/* --- Procedural studio environment: reflections without an HDRI file --- */}
      <Environment resolution={quality.environmentResolution}>
        <color attach="background" args={["#050507"]} />

        {/* Main ceiling softbox */}
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[0, 5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[9, 4, 1]}
          color="#ffffff"
        />
        {/* Long flank strips — the highlights that trace the bodywork */}
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[5, 1.4, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[12, 0.9, 1]}
          color="#eef4ff"
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[-5, 1.4, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[12, 0.9, 1]}
          color="#e2ecff"
        />
        {/* Ring of accent panels adds specular "sparkle" that reads as chrome */}
        {!reduced && (
          <>
            <Lightformer
              form="circle"
              intensity={1.2}
              position={[0, 2.2, -6]}
              scale={2.6}
              color="#00f0ff"
            />
            <Lightformer
              form="circle"
              intensity={1.0}
              position={[4.5, 1.8, -5]}
              scale={2}
              color="#d4af37"
            />
            <Lightformer
              form="ring"
              intensity={0.9}
              position={[0, 4.4, 3.6]}
              scale={3.2}
              color="#ffffff"
            />
          </>
        )}
      </Environment>
    </>
  );
}
