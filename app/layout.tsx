import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * SELF-HOSTED FONTS
 *
 * These were `next/font/google` and are now served from /public/fonts.
 *
 * Two reasons, in order of importance:
 *   1. `next/font/google` fetches from Google at BUILD time, so a build fails
 *      outright when the network is unavailable or behind a TLS-intercepting
 *      proxy. Self-hosting removes that failure mode entirely.
 *   2. It is also faster at runtime — no third-party DNS, no extra TLS
 *      handshake, no connection to fonts.gstatic.com — which matters on the
 *      mobile connections this showroom targets.
 *
 * Each family ships as several woff2 subsets. Browsers download only the
 * subset they need for the glyphs on screen, so listing them all costs
 * nothing extra on a Latin-only page.
 */

const display = localFont({
  src: [
    { path: "../public/fonts/syne-0.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/syne-1.woff2", weight: "600 700", style: "normal" },
    { path: "../public/fonts/syne-2.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Syne", "system-ui", "sans-serif"],
});

const body = localFont({
  src: [
    { path: "../public/fonts/inter-0.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/inter-1.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-2.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/inter-3.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["Inter", "system-ui", "sans-serif"],
});

const mono = localFont({
  src: [
    { path: "../public/fonts/jetbrains-mono-0.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/jetbrains-mono-1.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/jetbrains-mono-2.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "A Square Devs Cars — Hypercar Atelier",
  description:
    "An immersive 3D hypercar showroom. Configure, inspect and audition the world’s most exclusive machines.",
  applicationName: "A Square Devs Cars",
  keywords: [
    "hypercar",
    "showroom",
    "3D configurator",
    "webgl",
    "bugatti",
    "koenigsegg",
  ],
};

export const viewport: Viewport = {
  themeColor: "#08080A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-obsidian font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
