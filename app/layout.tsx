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
export const viewport: Viewport = {
  themeColor: "#0076b7",
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
