import type { MetadataRoute } from "next";

// PWA manifest (Next.js typed Metadata Route → /manifest.webmanifest).
// Colors are the app's existing design tokens, resolved to sRGB hex:
//   theme_color      = --jmh-blue  oklch(0.54 0.14 240) → #0076b7
//   background_color = --surface   oklch(1 0 0)         → #ffffff
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "איתן",
    short_name: "איתן",
    dir: "rtl",
    lang: "he",
    display: "standalone",
    start_url: "/home",
    background_color: "#ffffff",
    theme_color: "#0076b7",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
