import type { MetadataRoute } from "next";

// PWA manifest (Next.js typed Metadata Route → /manifest.webmanifest).
// Next injects <link rel="manifest"> automatically — do not hand-write one.
//
// Colors are the app's existing design tokens, resolved to sRGB hex:
//   theme_color      = --jmh-blue  oklch(0.54 0.14 240)   → #0076b7
//   background_color = --bg        oklch(0.980 0.007 240) → #f4f9fd
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "איתן",
    short_name: "איתן",
    description: "ניהול משימות ומשק בית למשפחה",
    dir: "rtl",
    lang: "he",
    display: "standalone",
    orientation: "portrait",
    // start_url is the dashboard; scope stays "/" so a notification tap into
    // /tasks (or anywhere else) stays inside the standalone window.
    start_url: "/home",
    scope: "/",
    background_color: "#f4f9fd",
    theme_color: "#0076b7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
