"use client";

// The app's frame: top tabs + a content area that scrolls inside it, pinned
// to exactly the visible part of the screen, like a native app.
//
// Why not 100dvh / position:fixed bottom:0: an iOS home-screen app often
// reports its window one status bar shorter than the screen at launch, which
// left an empty strip at the bottom. In that mode the app always covers the
// whole screen, so the frame is sized from the screen itself.
//
// Keyboard: iOS doesn't resize the page when the keyboard opens; it pans the
// view instead, hiding the composer behind the keyboard. While the keyboard
// is up, the frame takes the size and position of the visual viewport (the
// part above the keyboard), so the tabs stay on top and the composer sits
// right above the keys.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Box = { height: number | null; offset: number; keyboard: boolean };

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Full height of the app's area, in CSS px. */
function fullHeight(): number {
  if (!isStandalone()) return window.innerHeight;
  const { width, height } = window.screen;
  const landscape = window.matchMedia("(orientation: landscape)").matches;
  const screenH = landscape ? Math.min(width, height) : Math.max(width, height);
  // Never smaller than what the browser reports (in case it's ever right).
  return Math.max(screenH, window.innerHeight);
}

// Taller than any toolbar difference, shorter than any keyboard.
const KEYBOARD_MIN = 150;

export default function AppShell({ tabs, children }: { tabs: React.ReactNode; children: React.ReactNode }) {
  const [box, setBox] = useState<Box>({ height: null, offset: 0, keyboard: false });
  const contentRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Scrolling now happens inside the frame, so a new screen starts at the top.
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const full = fullHeight();
        const keyboard = !!vv && full - vv.height > KEYBOARD_MIN;
        setBox(
          keyboard && vv
            ? { height: Math.round(vv.height), offset: Math.round(vv.offsetTop), keyboard: true }
            : { height: full, offset: 0, keyboard: false }
        );
      });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    // iOS sometimes settles the launch size a moment later.
    const late = window.setTimeout(update, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        insetInline: 0,
        height: box.height ?? "100dvh",
        // Only while panned: a transform makes this the containing block for
        // fixed children (sheets, toasts), which is what we want then — they
        // stay inside the visible area above the keyboard.
        transform: box.offset ? `translateY(${box.offset}px)` : undefined,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        // viewport-fit:cover draws under the notch and home indicator. With the
        // keyboard up, the home indicator is covered, so no bottom inset.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: box.keyboard ? 0 : "env(safe-area-inset-bottom)",
        boxSizing: "border-box",
      }}
    >
      {tabs}
      <div
        ref={contentRef}
        // Scroll container for every screen. A flex column so the chat can
        // fill it (flex:1) while other screens just scroll.
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
