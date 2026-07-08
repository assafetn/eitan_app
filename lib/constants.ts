export const APP_NAME = "איתן";

export const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

// Brand + semantic color tokens offered by the design system. The only colors
// a user may pick for a responsibility or label — never an arbitrary hex.
// Each value is a CSS variable name (used as `var(--${token})`).
export const COLOR_TOKENS = [
  "jmh-blue",
  "jmh-sage",
  "jmh-gold",
  "jmh-coral",
  "jmh-periwinkle",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
