// Theme plumbing. Pure DOM/localStorage — no React, so the blocking <head>
// script and the client provider can share one source of truth.

export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "eitan-theme";

/** All three valid stored values, for validating whatever came out of storage. */
const THEMES: readonly Theme[] = ["system", "light", "dark"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Reads the stored preference. Returns "system" if unset, invalid, or if
 *  localStorage throws (Safari private mode). */
export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled — the theme still applies for this
    // session, it just won't survive a reload. Not worth surfacing.
  }
}

/** Collapses "system" to the concrete theme the OS is currently asking for. */
export function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "light" || t === "dark") return t;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function prefersDarkQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(DARK_QUERY);
}

/** Stamps the resolved theme on <html> and syncs the browser-chrome color.
 *  theme-color is read back from the computed --bg so it can never drift from
 *  the token — no second copy of the palette to keep in step. */
export function applyTheme(t: Theme): "light" | "dark" {
  const resolved = resolveTheme(t);
  if (typeof document === "undefined") return resolved;

  const root = document.documentElement;
  root.dataset.theme = resolved;

  // The <meta name="theme-color"> node comes from Next's `viewport` export in
  // app/layout.tsx; create one only if that ever goes away.
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (bg) meta.content = bg;

  return resolved;
}

/** Blocking inline <head> script: stamps data-theme BEFORE first paint so the
 *  dark palette is already in place and there's no white flash. Kept dependency
 *  -free and minified because it ships on every response; the try/catch covers
 *  localStorage throwing in private mode. */
export const THEME_INIT_SCRIPT =
  `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");` +
  `if(t!=="light"&&t!=="dark")t=window.matchMedia&&window.matchMedia("${DARK_QUERY}").matches?"dark":"light";` +
  `document.documentElement.setAttribute("data-theme",t)}catch(e){` +
  `document.documentElement.setAttribute("data-theme","light")}})();`;
