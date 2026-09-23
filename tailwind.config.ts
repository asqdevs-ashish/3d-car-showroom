import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: "#08080A",
          deep: "#0a0a0c",
          soft: "#101014",
          edge: "#16161c",
        },
        titanium: "#E2E8F0",
        gold: {
          DEFAULT: "#D4AF37",
          soft: "#E8CD74",
          deep: "#8C6F1F",
        },
        neon: {
          DEFAULT: "#00F0FF",
          deep: "#00A5B3",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Syne", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        ultra: "0.42em",
        wide2: "0.22em",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "scan-line": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.9" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "scan-line": "scan-line 4.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 3s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
