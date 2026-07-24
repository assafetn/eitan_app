import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import PWARegister from "@/components/PWARegister";

// Icons/manifest go through Next's typed metadata API — no hand-written <link>
// tags, and no manifest link here: Next injects one for app/manifest.ts.
export const metadata: Metadata = {
  title: APP_NAME,
  description: "ניהול משימות ולוח שנה משפחתי",
  applicationName: APP_NAME,
  // iOS Safari installability: treat as a standalone web app.
  appleWebApp: { capable: true, statusBarStyle: "default", title: "איתן" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
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
    <html lang="he" dir="rtl">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
