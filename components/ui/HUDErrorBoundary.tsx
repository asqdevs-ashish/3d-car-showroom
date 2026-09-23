"use client";

import { Component, type ReactNode } from "react";

/**
 * Surfaces a render error from a HUD subtree instead of letting React blank
 * the whole page with "Application error".
 *
 * The HUD is pure DOM and never throws by design, so if this boundary ever
 * catches something it is a genuine bug — and the message needs to be
 * readable rather than swallowed. In development the full stack is printed
 * to the console; in production (and in automated verification) it is
 * rendered into a data attribute so it can be asserted on.
 */
export class HUDErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { message: string | null; stack: string | null }
> {
  state = { message: null as string | null, stack: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
    };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      `[A Square Devs Cars] HUD subtree "${this.props.label}" threw:`,
      error,
    );
  }

  render() {
    if (this.state.message) {
      return (
        <div
          data-hud-error={this.state.message}
          className="pointer-events-auto max-w-[420px] border border-red-500/30 bg-red-500/[0.08] px-3 py-2.5"
        >
          <p className="font-mono text-[8.5px] uppercase tracking-wide2 text-red-300/90">
            {this.props.label} failed to render
          </p>
          <p className="mt-1 break-words font-mono text-[10px] leading-snug text-red-200/70">
            {this.state.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
