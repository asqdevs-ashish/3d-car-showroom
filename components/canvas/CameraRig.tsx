"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { cameraPresets } from "@/config/camera";
import { useShowroom } from "@/hooks/useShowroomStore";

/**
 * Camera mechanics.
 *
 * OrbitControls owns the camera while the user is exploring. When a preset
 * is requested we take the wheel: disable damping-driven user input, GSAP
 * lerps position + target across ~1.4s with a power3 ease, then we hand
 * control back. Nothing ever snaps.
 */
export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  /* Touch devices need gentler rotation — a finger drag covers far more
     screen per pixel than a mouse, so the same speed feels hypersensitive. */
  const hasTouch =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

  const cameraPresetId = useShowroom((s) => s.cameraPresetId);
  const setCameraPreset = useShowroom((s) => s.setCameraPreset);
  const setCameraAnimating = useShowroom((s) => s.setCameraAnimating);
  const registerCameraApi = useShowroom((s) => s.registerCameraApi);

  /* --- Expose an imperative API so the HUD can drive the camera --- */
  useEffect(() => {
    const goTo = (presetId: string) => {
      const preset = cameraPresets.find((p) => p.id === presetId);
      const controls = controlsRef.current;
      if (!preset || !controls) return;

      setCameraPreset(preset.id);
      setCameraAnimating(true);

      // Lock user input for the duration so the tween can't fight a drag.
      controls.enabled = false;

      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.target);

      gsap.to(camera.position, {
        x: preset.position[0],
        y: preset.position[1],
        z: preset.position[2],
        duration: 1.4,
        ease: "power3.inOut",
        onUpdate: () => controls.update(),
      });

      gsap.to(controls.target, {
        x: preset.target[0],
        y: preset.target[1],
        z: preset.target[2],
        duration: 1.4,
        ease: "power3.inOut",
        onUpdate: () => controls.update(),
        onComplete: () => {
          controls.enabled = true;
          setCameraAnimating(false);
        },
      });

      // Animate FOV too — a subtle lens compression sells the dolly move.
      if (preset.fov && camera instanceof THREE.PerspectiveCamera) {
        gsap.to(camera, {
          fov: preset.fov,
          duration: 1.4,
          ease: "power3.inOut",
          onUpdate: () => camera.updateProjectionMatrix(),
        });
      }
    };

    registerCameraApi({ goTo });
    return () => registerCameraApi(null);
  }, [camera, registerCameraApi, setCameraAnimating, setCameraPreset]);

  /* --- Fly to the initial preset once on mount --- */
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const preset = cameraPresets[0];
    camera.position.set(...preset.position);
    controls.target.set(...preset.target);
    if (preset.fov && camera instanceof THREE.PerspectiveCamera) {
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
    }
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- When the selected car changes, settle to a hero angle --- */
  const selectedCarId = useShowroom((s) => s.selectedCarId);
  const isFirstCar = useRef(true);
  useEffect(() => {
    if (isFirstCar.current) {
      isFirstCar.current = false;
      return;
    }
    // New car in the atelier: return to the aggressive front stance.
    const goTo = useShowroom.getState().cameraApi?.goTo;
    goTo?.(cameraPresets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCarId, cameraPresetId]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.05}
      /* Halve rotation speed on touch so a swipe cannot spin the car. */
      rotateSpeed={hasTouch ? 0.5 : 0.8}
      zoomSpeed={hasTouch ? 0.6 : 0.8}
      /* Restricted polar angles: never dip below the studio floor. */
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2 - 0.05}
      /* Keep the framing tight so the car always fills the viewfinder. */
      minDistance={3.4}
      maxDistance={18}
      /* Framed for the car's centre of mass, not the floor. */
      target={[0, 0.85, 0]}
    />
  );
}
