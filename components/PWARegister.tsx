"use client";

import { useEffect } from "react";

/**
 * Registers the push service worker at root scope. Renders nothing.
 *
 * Failure is non-fatal and deliberately silent to the user: an unsupported
 * browser, a private-mode restriction, or an insecure origin must never throw or
 * surface UI — the app works fine without push.
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
