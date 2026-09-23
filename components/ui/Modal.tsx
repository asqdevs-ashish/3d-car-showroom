"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  accent?: string;
}

/**
 * The house modal: a centred glass slab over a heavily dimmed, blurred
 * page. Deliberately no rounded cartoon corners — this is a specification
 * document, not a chat bubble.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  accent = "#D4AF37",
}: ModalProps) {
  /* Escape closes; body scroll locks behind the panel. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Scrim */}
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-obsidian/80 backdrop-blur-md"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "glass-panel-strong noise-overlay absolute left-1/2 top-1/2 w-[min(92vw,540px)]",
              "-translate-x-1/2 -translate-y-1/2 overflow-hidden",
            )}
          >
            {/* Accent hairline across the top edge */}
            <span
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
            />

            <div className="relative px-7 pb-7 pt-8 sm:px-9 sm:pb-9">
              <p className="hud-label" style={{ color: accent }}>
                {eyebrow}
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide2 text-titanium sm:text-3xl">
                {title}
              </h2>

              <div className="mt-6">{children}</div>

              <button
                type="button"
                onClick={onClose}
                className="mt-8 w-full border-white/12 py-3 font-mono text-[10px] uppercase tracking-ultra text-white/55 transition-colors duration-300 hover:border-white/30 hover:text-titanium"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
