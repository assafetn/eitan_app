"use client";

// Pull down at the top of a list to reload it from the server, like a native
// iOS list. An installed home-screen app has no browser pull-to-refresh, so
// this does it: it listens on the app frame's scroll container (AppShell),
// and only takes over a downward drag that starts at the very top.
//
// The reload is router.refresh() inside a transition: the server components
// re-run and the page's client state syncs from the new props.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, RefreshCw } from "lucide-react";

const TRIGGER = 64; // px of (damped) pull that triggers a refresh
const MAX_PULL = 96;
const HOLD = 52; // where the indicator rests while refreshing
const MIN_SPIN_MS = 600; // a too-quick spinner reads as a glitch

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === "auto" || oy === "scroll") return n;
  }
  return null;
}

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const spinSince = useRef(0);

  // Finish once the refresh transition is done (and the spinner had its moment).
  useEffect(() => {
    if (!refreshing || isPending) return;
    const left = Math.max(0, MIN_SPIN_MS - (Date.now() - spinSince.current));
    const t = window.setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
    }, left);
    return () => window.clearTimeout(t);
  }, [refreshing, isPending]);

  useEffect(() => {
    const scroller = scrollParent(rootRef.current);
    if (!scroller) return;

    let startY = 0;
    let startX = 0;
    let active = false; // this touch is (possibly) a pull
    let pulling = false; // decided: it is a pull
    let current = 0;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      // Only from the very top, and not from inside a sheet or dialog.
      if (scroller.scrollTop > 0) return;
      if ((e.target as HTMLElement).closest?.('[role="dialog"]')) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      active = true;
      pulling = false;
      current = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!pulling) {
        // A sideways swipe (swipe-to-delete) or an upward scroll isn't ours.
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0 || scroller.scrollTop > 0) {
          if (Math.abs(dx) > 8 || dy < -8) active = false;
          return;
        }
        if (dy < 6) return;
        pulling = true;
        setDragging(true);
      }
      // Ours now: stop the native rubber-band, follow the finger with resistance.
      if (e.cancelable) e.preventDefault();
      current = Math.min(MAX_PULL, Math.max(0, dy) * 0.5);
      setPull(current);
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (!pulling) return;
      pulling = false;
      setDragging(false);
      if (current >= TRIGGER) {
        refreshingRef.current = true;
        spinSince.current = Date.now();
        setRefreshing(true);
        setPull(HOLD);
        navigator.vibrate?.(8);
        startTransition(() => router.refresh());
      } else {
        setPull(0);
      }
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    // Non-passive: it has to be able to cancel the native overscroll.
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd);
    scroller.addEventListener("touchcancel", onEnd);
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const progress = Math.min(1, pull / TRIGGER);
  const ready = progress >= 1;
  const ease = dragging ? "none" : "transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {/* The indicator rides above the content, revealed by the pull. */}
      <div
        aria-hidden={!refreshing}
        role={refreshing ? "status" : undefined}
        aria-label={refreshing ? "מרענן…" : undefined}
        style={{
          position: "absolute",
          top: 0,
          insetInline: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          transform: `translateY(${pull - 40}px)`,
          opacity: refreshing ? 1 : progress,
          transition: ease,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            color: ready || refreshing ? "var(--jmh-blue)" : "var(--text-muted)",
            transition: "color var(--dur-fast) var(--ease-out)",
          }}
        >
          {refreshing ? (
            <RefreshCw size={17} strokeWidth={2.2} className="ptr-spin" />
          ) : (
            <ArrowDown
              size={17}
              strokeWidth={2.2}
              // Flips to point up once letting go would refresh.
              style={{ transform: `rotate(${ready ? 180 : 0}deg)`, transition: "transform var(--dur-base) var(--ease-out)" }}
            />
          )}
        </span>
      </div>

      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: ease }}>{children}</div>
    </div>
  );
}
