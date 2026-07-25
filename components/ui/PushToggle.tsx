"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/ui/Toast";

// A VAPID public key is base64url; PushManager.subscribe needs the raw bytes.
// Passing the string straight through fails on iOS Safari.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Inlined at build time; undefined here means the env var was missing when the
// bundle was built, which we surface rather than fail silently on.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Env = {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission;
};

const noteStyle: React.CSSProperties = {
  fontFamily: "var(--font)",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  margin: 0,
};

export default function PushToggle() {
  // Starts null so SSR and the first client render agree (nothing rendered);
  // everything below is browser-only and resolved in the effect.
  const [env, setEnv] = useState<Env | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function detect() {
      const supported =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        typeof window !== "undefined" &&
        "PushManager" in window;

      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      // iPadOS 13+ reports a Mac UA, so touch-capable "macintosh" is really an iPad.
      const isIOS =
        /iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const permission: NotificationPermission =
        typeof Notification !== "undefined" ? Notification.permission : "default";

      let hasSub = false;
      if (supported) {
        try {
          const reg = await navigator.serviceWorker.ready;
          hasSub = !!(await reg.pushManager.getSubscription());
        } catch {
          hasSub = false;
        }
      }

      if (!mounted) return;
      setEnv({ supported, isIOS, isStandalone, permission });
      setEnabled(hasSub && permission === "granted");
    }

    detect();
    return () => {
      mounted = false;
    };
  }, []);

  async function enable() {
    // GESTURE-CRITICAL: this must be the first statement, before any await.
    // Awaiting anything first discards the user-gesture context on iOS and the
    // permission prompt never appears.
    const perm = await Notification.requestPermission();

    if (perm !== "granted") {
      setEnabled(false);
      setEnv((e) => (e ? { ...e, permission: perm } : e));
      setBusy(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.7 types Uint8Array as generic over its buffer, so the helper's
        // Uint8Array<ArrayBufferLike> no longer satisfies BufferSource (which
        // excludes SharedArrayBuffer). The value is a plain Uint8Array at
        // runtime; the cast is only to satisfy the DOM lib types.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);

      setEnabled(true);
      setEnv((e) => (e ? { ...e, permission: "granted" } : e));
      setToast("ההתראות הופעלו");
    } catch (err) {
      console.error("[push] enable failed:", err);
      setEnabled(false);
      setToast("הפעלת ההתראות נכשלה, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setToast("ההתראות כובו");
    } catch (err) {
      console.error("[push] disable failed:", err);
      setToast("כיבוי ההתראות נכשל, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  function onToggle() {
    if (busy) return;
    setBusy(true);
    // Not awaited: enable() must reach requestPermission() synchronously within
    // this click handler to keep the gesture context.
    if (enabled) disable();
    else enable();
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error(`test failed: ${res.status}`);
      const { sent, failed, pruned } = (await res.json()) as {
        sent: number;
        failed: number;
        pruned: number;
      };
      if (sent > 0) {
        setToast(`נשלחו ${sent} התראות`);
      } else if (pruned > 0) {
        setToast("הרישום פג תוקף — הפעילו מחדש את ההתראות");
      } else if (failed > 0) {
        setToast("שליחת ההתראה נכשלה");
      } else {
        setToast("לא נמצאו מכשירים רשומים");
      }
    } catch (err) {
      console.error("[push] test failed:", err);
      setToast("שליחת ההתראה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  // Nothing until detection completes, and nothing at all where push can't work.
  if (!env) return null;
  if (!env.supported) return null;

  // Missing at build time — must be visible, not an invisible no-op.
  if (!VAPID_PUBLIC_KEY) {
    return (
      <p style={noteStyle}>
        ההתראות אינן מוגדרות: המפתח הציבורי חסר. יש להגדיר את
        NEXT_PUBLIC_VAPID_PUBLIC_KEY ולפרוס מחדש.
      </p>
    );
  }

  const iosNotInstalled = env.isIOS && !env.isStandalone;
  const blocked = env.permission === "denied";
  const disabled = busy || iosNotInstalled || blocked;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            fontWeight: 500,
            color: disabled ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          התראות על משימות
        </span>

        {/* Switch. The visible track is 52x32 but the button pads out to a 44px
            minimum touch target. */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="התראות על משימות"
          disabled={disabled}
          onClick={onToggle}
          style={{
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 52,
              height: 32,
              borderRadius: "var(--r-full)",
              background: enabled ? "var(--jmh-blue)" : "var(--border-strong)",
              display: "inline-flex",
              alignItems: "center",
              padding: 3,
              boxSizing: "border-box",
              transition: `background var(--dur-fast) var(--ease-out)`,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--surface)",
                boxShadow: "var(--shadow-sm)",
                // RTL: "on" sits at the start edge, so travel is mirrored.
                transform: enabled ? "translateX(-20px)" : "translateX(0)",
                transition: `transform var(--dur-base) var(--ease-out)`,
              }}
            />
          </span>
        </button>
      </div>

      {iosNotInstalled && (
        <p style={noteStyle}>כדי לקבל התראות, פתחו את איתן מהאפליקציה במסך הבית.</p>
      )}
      {blocked && <p style={noteStyle}>ההתראות חסומות. יש לאפשר אותן בהגדרות הדפדפן.</p>}

      {enabled && !iosNotInstalled && !blocked && (
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          style={{
            alignSelf: "flex-start",
            minHeight: 44,
            padding: "0 16px",
            borderRadius: "var(--r-full)",
            border: "1px solid var(--border-strong)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          שלח התראת בדיקה
        </button>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
