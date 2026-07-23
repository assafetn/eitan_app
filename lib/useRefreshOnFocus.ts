"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10_000;
// After a route change, stay quiet briefly so a focus/visibility refresh can't
// land on top of (and appear to stall) a fresh navigation.
const NAV_QUIET_MS = 1_000;

/**
 * Re-runs server queries (via router.refresh()) when the tab becomes visible
 * or the window regains focus, so data changed on another device shows up
 * without a manual reload. Debounced to fire at most once every 10 seconds.
 *
 * The refresh is wrapped in startTransition so it is interruptible and never
 * blocks a user-initiated navigation, and it is skipped entirely while a
 * transition is already pending or right after the route just changed — the
 * combination that previously made tab switches appear to hang.
 */
export function useRefreshOnFocus() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const lastRefreshRef = useRef(0);
  const lastNavRef = useRef(0);
  // Mirror isPending into a ref so the event listeners read the live value
  // without needing to re-subscribe on every pending change.
  const isPendingRef = useRef(isPending);
  isPendingRef.current = isPending;

  // Stamp the time of each route change; a refresh within NAV_QUIET_MS is skipped.
  useEffect(() => {
    lastNavRef.current = Date.now();
  }, [pathname]);

  useEffect(() => {
    const maybeRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_INTERVAL_MS) return; // 10s debounce
      // Never fight a navigation.
      if (isPendingRef.current) return;
      if (now - lastNavRef.current < NAV_QUIET_MS) return;
      lastRefreshRef.current = now;
      // Interruptible: a user-initiated navigation can preempt this refresh.
      startTransition(() => {
        router.refresh();
      });
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
  }, [router, startTransition]);
}
