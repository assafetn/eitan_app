"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Returns a debounced `router.refresh()`. App Router keeps the layout mounted
 * across client navigations, so the streamed nav badges don't re-fetch on their
 * own after a mutation — calling this in a mutation's success path re-runs the
 * server components (and thus the badge counts). Rapid calls (e.g. tapping
 * several toggles) coalesce into a single refresh. No polling, no realtime.
 */
export function useCoalescedRefresh(delayMs = 400) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, delayMs);
  }, [router, delayMs]);
}
