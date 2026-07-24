"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "eitan:install-hint-dismissed";

/**
 * Dismissible hint telling iOS users to add איתן to the home screen — Web Push
 * on iOS only works from an installed (standalone) app.
 *
 * Every check (user agent, display-mode, localStorage) is browser-only, so all
 * of it runs in an effect behind a `show` flag that starts false. The server and
 * the first client render therefore always agree (nothing rendered), which
 * avoids a hydration mismatch.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let mounted = true;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage can throw in private mode — treat as "not dismissed".
    }

    const ua = navigator.userAgent;
    // iPadOS 13+ reports a Mac UA, so a touch-capable "macintosh" is really an iPad.
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (mounted && isIOS && !isStandalone) setShow(true);

    return () => {
      mounted = false;
    };
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Non-persistent dismissal is an acceptable degradation.
    }
  }

  if (!show) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-3)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--sp-4)",
        marginBottom: "var(--sp-6)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 var(--sp-1)",
          }}
        >
          התקינו את איתן במסך הבית
        </p>
        <p
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          בספארי: הקישו על כפתור השיתוף, ואז על ״הוספה למסך הבית״. התראות עובדות רק מהאפליקציה
          במסך הבית.
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="סגירת ההודעה"
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderRadius: "var(--r-sm)",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
