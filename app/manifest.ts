import type { MetadataRoute } from "next";

// PWA manifest (Next.js typed Metadata Route → /manifest.webmanifest).
// Next injects <link rel="manifest"> automatically — do not hand-write one.
//
// These icons serve Android and desktop ONLY. iOS web clips ignore the manifest
// entirely and read <link rel="apple-touch-icon"> instead, which comes from the
// `icons.apple` entry in app/layout.tsx.
//
// theme_color/background_color are the app-icon tile's own charcoal
// (#161618 = the bottom stop of the tile gradient in assets/icon.svg), so the
// install splash and the task-switcher card match the home-screen icon. This is
// deliberately independent of the runtime <meta name="theme-color">, which
// ThemeProvider keeps in sync with the active light/dark --bg token.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "איתן",
    short_name: "איתן",
    description: "ניהול משימות ומשק בית למשפחה",
    lang: "he",
    dir: "rtl",
    display: "standalone",
    orientation: "portrait",
    // start_url is the dashboard; scope stays "/" so a notification tap into
    // /tasks (or anywhere else) stays inside the standalone window.
    start_url: "/home",
    scope: "/",
    background_color: "#161618",
    theme_color: "#161618",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
