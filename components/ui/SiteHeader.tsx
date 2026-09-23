"use client";

import { useEffect, useState } from "react";
import { Gauge, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useShowroom } from "@/hooks/useShowroomStore";
import { cn } from "@/lib/cn";
import { carCount } from "@/config/cars";

interface SiteHeaderProps {
  accent: string;
}

/**
 * Floating command bar.
 *
 * Three zones: identity (left), telemetry (centre, desktop only), and
 * actions (right). On mobile it collapses to identity + a menu button and
 * the actions move into a full-height sheet.
 */
export function SiteHeader({ accent }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const openModal = useShowroom((s) => s.openModal);

  /* Condense the bar once the user interacts, so it stops competing with the car. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const actions = [
    { label: "Book Test Drive", kind: "test-drive" as const },
    { label: "Inquire Purchase", kind: "inquire" as const },
  ];

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "py-2" : "py-4 sm:py-6",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex items-center justify-between gap-4 px-4 sm:px-7",
          "transition-all duration-500",
        )}
      >
        {/* ---------- Identity ---------- */}
        <div className="flex items-center gap-3">
          {/* Monogram plate */}
          <div className="relative grid h-9 w-9 place-items-center border-white/12">
            <span className="font-display text-sm font-extrabold text-titanium">
              A
            </span>
            <span
              className="absolute -bottom-px -right-px h-1.5 w-1.5"
              style={{ background: accent }}
            />
          </div>

          <div className="leading-none">
            <h1 className="font-display text-[11px] font-extrabold uppercase tracking-ultra text-titanium sm:text-xs">
              A Square Devs
            </h1>
            <p className="mt-1 font-mono text-[8px] uppercase tracking-wide2 text-white/35">
              Hypercar Atelier
            </p>
          </div>
        </div>

        {/* ---------- Telemetry strip (desktop) ---------- */}
        <div className="hidden items-center gap-6 lg:flex">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ background: accent }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: accent }}
              />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wide2 text-white/45">
              Live · Showroom Floor
            </span>
          </div>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-mono text-[9px] uppercase tracking-wide2 text-white/45">
            {carCount} vehicles on display
          </span>
        </div>

        {/* ---------- Actions ---------- */}
        <div className="flex items-center gap-2">

          {/* CTAs (desktop) */}
          <div className="hidden items-center gap-2 md:flex">
            {actions.map((action, index) => (
              <button
                key={action.kind}
                type="button"
                onClick={() => openModal(action.kind)}
                className={cn(
                  "sweep group relative flex items-center gap-2 border px-4 py-2.5",
                  "font-mono text-[9px] uppercase tracking-wide2 transition-all duration-300",
                  index === 0
                    ? "border-white/12 text-white/65 hover:border-white/35 hover:text-titanium"
                    : "border-transparent text-obsidian",
                )}
                style={index !== 0 ? { background: accent } : undefined}
              >
                {index === 0 && <Gauge className="h-3 w-3" strokeWidth={1.6} />}
                <span className="relative z-10">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 place-items-center border-white/12 text-white/60 transition-colors hover:text-titanium md:hidden"
          >
            {menuOpen ? (
              <X className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
        </div>
      </div>

      {/* ---------- Mobile action sheet ---------- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto mx-4 mt-3 glass-panel-strong overflow-hidden md:hidden"
          >
            {actions.map((action, index) => (
              <button
                key={action.kind}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openModal(action.kind);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-5 py-4",
                  "font-mono text-[10px] uppercase tracking-wide2 transition-colors",
                  index > 0 && "border-t border-white/8",
                  index === 0 ? "text-white/70" : "text-obsidian",
                )}
                style={index !== 0 ? { background: accent } : undefined}
              >
                {action.label}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.6} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side nav arrows for quick car stepping (desktop) */}
      <DesktopStepper accent={accent} />
    </header>
  );
}

/** Thin edge arrows so users can step through the fleet without the deck. */
function DesktopStepper({ accent }: { accent: string }) {
  const stepCar = useShowroom((s) => s.stepCar);

  const buttonClass =
    "pointer-events-auto fixed top-1/2 z-40 hidden h-12 w-9 -translate-y-1/2 place-items-center border-white/10 text-white/40 transition-all duration-300 hover:text-titanium md:grid";

  return (
    <>
      <button
        type="button"
        onClick={() => stepCar(-1)}
        aria-label="Previous vehicle"
        className={cn(buttonClass, "left-3 lg:left-5")}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.4} />
      </button>
      <button
        type="button"
        onClick={() => stepCar(1)}
        aria-label="Next vehicle"
        className={cn(buttonClass, "right-3 lg:right-5")}
      >
        <ChevronRight
          className="h-4 w-4"
          strokeWidth={1.4}
          style={{ color: accent }}
        />
      </button>
    </>
  );
}
