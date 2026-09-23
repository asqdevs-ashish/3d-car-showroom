"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";

import { useSelectedCar, useShowroom } from "@/hooks/useShowroomStore";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { CarHUD } from "@/components/ui/CarHUD";
import { ShowroomModals } from "@/components/ui/ShowroomModals";
import { LuxuryLoader } from "@/components/ui/LuxuryLoader";

/**
 * The WebGL canvas is client-only: it touches `window`, `WebGLRenderingContext`
 * and large three.js modules. `ssr: false` keeps it out of the server bundle
 * and guarantees the loader is the first thing painted.
 */
const ShowroomCanvas = dynamic(
  () =>
    import("@/components/canvas/ShowroomCanvas").then(
      (mod) => mod.ShowroomCanvas,
    ),
  {
    ssr: false,
    // The LuxuryLoader covers this gap, so an inline fallback is unnecessary.
    loading: () => null,
  },
);

/**
 * Top-level composition.
 *
 * Order in the DOM matters: canvas (z-0) → HUD (z-30) → header (z-50) →
 * modals (z-90) → loader (z-100). Every overlay above the canvas is
 * pointer-events-none at the root so orbit-drag still works over empty space.
 */
export function ShowroomExperience() {
  const [showLoader, setShowLoader] = useState(true);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const car = useSelectedCar();
  const setLoading = useShowroom((s) => s.setLoading);

  /* --- Mount the canvas behind the curtain so the first frame is ready --- */
  const handleLoaderComplete = useCallback(() => {
    setShowLoader(false);
    setLoading(false);
  }, [setLoading]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-obsidian">
      {/* ---------- 3D layer ---------- */}
      <div className="absolute inset-0 z-0">
        {/* Mount the canvas immediately; the loader overlays it. */}
        {!canvasMounted && (
          <CanvasMountSignal onMount={() => setCanvasMounted(true)} />
        )}
        <ShowroomCanvas />
      </div>

      {/* ---------- Vignette + grain over the render ---------- */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 45%, transparent 42%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* ---------- 2D HUD ---------- */}
      <CarHUD />

      {/* ---------- Header ---------- */}
      <SiteHeader accent={car.signature} />

      {/* ---------- Modals ---------- */}
      <ShowroomModals />

      {/* ---------- Entry curtain ---------- */}
      <AnimatePresence>
        {showLoader && <LuxuryLoader onComplete={handleLoaderComplete} />}
      </AnimatePresence>

      {/*
       * No footer rail.
       *
       * There was a fixed "drag to orbit / scroll to zoom" hint pinned to
       * bottom-2, which sat directly on top of the paint configurator's swatch
       * rail — the two overlapped and both became hard to read. The
       * interaction is discoverable without it, and the HUD's bottom edge is
       * already fully occupied by the spec sheet and colour swatches.
       */}
    </main>
  );
}

/**
 * Tiny helper that reports when the lazy canvas chunk has mounted. Kept
 * separate so `ShowroomExperience` never suspends on the import itself.
 */
function CanvasMountSignal({ onMount }: { onMount: () => void }) {
  if (typeof window !== "undefined") onMount();
  return null;
}
