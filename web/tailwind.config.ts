import type { Config } from "tailwindcss";

// MIZAN design tokens (docs/13 §A.2). Dark mode via class; stress/confidence
// color scales are first-class so badges/maps can reference them by name.
const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          cobalt: { DEFAULT: "#1D4ED8", 50: "#EFF6FF", 900: "#1E3A8A" },
          amber: { DEFAULT: "#D97706", 50: "#FFFBEB", 900: "#78350F" },
          crimson: { DEFAULT: "#DC2626", 50: "#FEF2F2", 900: "#7F1D1D" },
        },
        // gw_stress_class scale (docs/08 §4).
        stress: {
          low: "#16A34A",
          moderate: "#CA8A04",
          high: "#EA580C",
          severe: "#DC2626",
        },
        // confidence_level scale (docs/09 §4.3).
        confidence: {
          high: "#0D9488",
          medium: "#D97706",
          low: "#9CA3AF",
        },
        surface: {
          light: "#F8FAFC",
          dark: "#0F172A",
        },
        // Semantic tokens backed by CSS variables (light/dark, docs/13 §A.2).
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        arabic: ["Cairo", "Noto Sans Arabic", "ui-sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
