import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Courier New", "monospace"],
      },
      colors: {
        // Primary sky blue scale
        "jmh-blue":       "var(--jmh-blue)",
        "jmh-blue-80":    "var(--jmh-blue-80)",
        "jmh-blue-60":    "var(--jmh-blue-60)",
        "jmh-blue-30":    "var(--jmh-blue-30)",
        "jmh-blue-10":    "var(--jmh-blue-10)",
        "jmh-blue-05":    "var(--jmh-blue-05)",
        // Secondary
        "jmh-periwinkle":    "var(--jmh-periwinkle)",
        "jmh-periwinkle-bg": "var(--jmh-periwinkle-bg)",
        // Semantic
        "jmh-sage":       "var(--jmh-sage)",
        "jmh-sage-bg":    "var(--jmh-sage-bg)",
        "jmh-coral":      "var(--jmh-coral)",
        "jmh-coral-bg":   "var(--jmh-coral-bg)",
        "jmh-gold":       "var(--jmh-gold)",
        "jmh-gold-bg":    "var(--jmh-gold-bg)",
        // Surface / neutrals
        bg:               "var(--bg)",
        surface:          "var(--surface)",
        border:           "var(--border)",
        "border-strong":  "var(--border-strong)",
        // Text
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",
        "text-on-blue":   "var(--text-on-blue)",
      },
      fontSize: {
        xs:   ["var(--text-xs)",   { lineHeight: "1.5" }],
        sm:   ["var(--text-sm)",   { lineHeight: "1.5" }],
        base: ["var(--text-base)", { lineHeight: "1.65" }],
        md:   ["var(--text-md)",   { lineHeight: "1.4" }],
        lg:   ["var(--text-lg)",   { lineHeight: "1.3" }],
        xl:   ["var(--text-xl)",   { lineHeight: "1.25" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "1.15" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "1.1" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "1.05" }],
      },
      spacing: {
        1: "var(--sp-1)",
        2: "var(--sp-2)",
        3: "var(--sp-3)",
        4: "var(--sp-4)",
        5: "var(--sp-5)",
        6: "var(--sp-6)",
        8: "var(--sp-8)",
        10: "var(--sp-10)",
        12: "var(--sp-12)",
        16: "var(--sp-16)",
      },
      borderRadius: {
        sm:   "var(--r-sm)",
        md:   "var(--r-md)",
        lg:   "var(--r-lg)",
        xl:   "var(--r-xl)",
        full: "var(--r-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in": "var(--ease-in)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
    },
  },
  plugins: [],
};

export default config;
