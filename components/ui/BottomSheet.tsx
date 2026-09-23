"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ChevronUp, GripHorizontal, X } from "lucide-react";

import { cn } from "@/lib/cn";

interface BottomSheetProps {
  /** Content revealed when expanded. */
  children: React.ReactNode;
  /** Always-visible summary row — the compact stats on mobile. */
  summary: React.ReactNode;
  accent: string;
  /** Accessible label for the sheet's toggle. */
  label: string;
}

/** Height of the collapsed summary bar, in px. */
const COLLAPSED_HEIGHT = 92;

/**
 * Mobile bottom sheet drawer.
 *
 * Replaces the desktop's floating glass cards on small screens. The 3D car is
 * the product here, so on a phone the HUD collapses to a compact stats row and
 * the heavyweight panels move into a drawer the user opens deliberately.
 *
 * Three interaction paths, because a drawer that only responds to one of them
 * feels broken:
 *   1. tap the handle / summary — toggle open and closed
 *   2. drag the handle down — dismiss (velocity-aware, via `useDragControls`)
 *   3. drag up — expand from the collapsed state
 *
 * Swipe-down-to-close is standard on iOS, and users try it whether or not it
 * is advertised, so it has to work.
 */
export function BottomSheet({
  children,
  summary,
  accent,
  label,
}: BottomSheetProps) {
  const [open, setOpen] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  /* Lock the page behind an open sheet so the drawer never fights a scroll. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      {/* Scrim — only while expanded, so the collapsed bar never blocks the car. */}
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
            className="pointer-events-auto fixed inset-0 z-40 bg-obsidian/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={sheetRef}
        /*
         * `drag="y"` with `dragConstraints` above the resting position lets the
         * sheet be pulled up but never below its collapsed height, which is
         * what keeps the summary row reachable at all times.
         */
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: -360, bottom: 0 }}
        dragElastic={{ top: 0.08, bottom: 0.04 }}
        onDragEnd={(_, info) => {
          /* A decisive downward flick closes; anything else snaps back. */
          const flickedDown = info.velocity.y > 420;
          const draggedFar = info.offset.y > 110;
          if (flickedDown || draggedFar) setOpen(false);
        }}
        animate={{ y: open ? -360 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        style={{ touchAction: "none" }}
        className={cn(
          "pointer-events-auto fixed inset-x-0 bottom-0 z-50 lg:hidden",
          "glass-panel-strong border-t border-white/10",
          // Honour the home-indicator inset on notched devices.
          "pb-[max(0.75rem,var(--safe-bottom))]",
        )}
      >
        {/* Accent hairline */}
        <span
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />

        {/* ---------------- Handle ---------------- */}
        <div
          onPointerDown={(event) => dragControls.start(event)}
          className="flex cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing"
          aria-hidden
        >
          <GripHorizontal className="h-4 w-4 text-white/25" strokeWidth={1.6} />
        </div>

        {/* ---------------- Summary row (always visible) ---------------- */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={label}
          className="flex w-full items-center gap-3 px-4 pb-3 pt-1 text-left"
        >
          <div className="min-w-0 flex-1">{summary}</div>

          <span
            className="grid h-7 w-7 shrink-0 place-items-center border transition-transform duration-300"
            style={{
              borderColor: `${accent}44`,
              color: accent,
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            {open ? (
              <X className="h-3.5 w-3.5" strokeWidth={1.6} />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
          </span>
        </button>

        {/* ---------------- Expanded content ---------------- */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="no-scrollbar max-h-[260px] overflow-y-auto overscroll-contain px-4 pb-2"
              style={{ touchAction: "pan-y" }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

/** Exported so callers can keep their own layout clear of the collapsed bar. */
export const BOTTOM_SHEET_HEIGHT = COLLAPSED_HEIGHT;
