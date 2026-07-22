import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "ניהול משימות ולוח שנה משפחתי",
  // iOS Safari installability: treat as a standalone web app.
  appleWebApp: { capable: true, statusBarStyle: "default", title: "איתן" },
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
      <body>{children}</body>
    </html>
  );
}
