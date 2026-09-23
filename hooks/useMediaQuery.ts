"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Returns `false` on the server and during the
 * first client paint so markup matches, then settles on the real value.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/**
 * True on phones / small tablets. Drives the entire performance budget:
 * shadow map size, reflector resolution, post-processing, DPR cap.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

/** Low-power class devices also get the reduced quality budget. */
export function useIsLowPower(): boolean {
  const isMobile = useIsMobile();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  return isMobile || reducedMotion || (coarsePointer && isMobile);
}
