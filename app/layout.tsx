import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import PWARegister from "@/components/PWARegister";
import ThemeProvider from "@/components/ui/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Icons/manifest go through Next's typed metadata API — no hand-written <link>
// tags, and no manifest link here: Next injects one for app/manifest.ts.
export const metadata: Metadata = {
  title: APP_NAME,
  description: "ניהול משימות ולוח שנה משפחתי",
  applicationName: APP_NAME,
  // iOS Safari installability: treat as a standalone web app.
  // black-translucent lets the app paint under the status bar, which is what
  // the dark charcoal icon/tile expects.
  appleWebApp: {
    capable: true,
    title: "איתן",
    statusBarStyle: "black-translucent",
  },
  // The iPhone home-screen icon comes from `apple` (the web-clip link tag) —
  // NOT from the manifest, which only serves Android/desktop.
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

// theme_color for the browser UI (matches the manifest / --jmh-blue token).
// width/initialScale pin the layout viewport to the device so iOS can't render
// a wide 980px page; viewportFit:cover makes the app fill edge-to-edge under the
// notch and exposes the safe-area-inset-* envs. Zoom is deliberately NOT locked
// (no maximumScale / userScalable) so pinch-to-zoom stays available.
export const viewport: Viewport = {
  themeColor: "#0076b7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the inline script below mutates <html>'s
    // data-theme before React hydrates, so the server markup deliberately
    // doesn't match. It suppresses that one attribute diff, nothing deeper.
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        {/* MUST stay first and blocking — it stamps data-theme before the first
            paint, which is the whole reason dark mode doesn't flash white. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
