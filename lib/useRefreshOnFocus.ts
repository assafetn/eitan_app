"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10_000;

/**
 * Re-runs server queries (via router.refresh()) when the tab becomes visible
 * or the window regains focus, so data changed on another device shows up
 * without a manual reload. Debounced to fire at most once every 10 seconds.
 */
export function useRefreshOnFocus() {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const maybeRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_INTERVAL_MS) return;
      lastRefreshRef.current = now;
      router.refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", maybeRefresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [router]);
}
