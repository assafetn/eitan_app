"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** The message to show. When null, nothing renders. */
  message: string | null;
  /** Called after the auto-dismiss delay (or lets the parent clear it). */
  onDismiss: () => void;
}

// Auto-dismiss delay for the failure toast.
const TOAST_MS = 3000;

// Minimal transient toast, fixed just above the bottom nav. Used to surface a
// failed optimistic update ("save failed, try again"). Tokens only — no colors
// or emoji of its own.
export default function Toast({ message, onDismiss }: Props) {
  // Keep the latest onDismiss without re-arming the timer on every parent render.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onDismissRef.current(), TOAST_MS);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      style={{
        position: "fixed",
        bottom: 96, // clears the fixed bottom nav
        insetInlineStart: 0,
        insetInlineEnd: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 var(--sp-4)",
        pointerEvents: "none", // never intercept taps meant for the nav/content
        zIndex: 60, // above the bottom nav (50)
      }}
    >
      <div
        style={{
          maxWidth: 360,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-md)",
          padding: "10px 16px",
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "var(--text-primary)",
          textAlign: "center",
        }}
      >
        {message}
      </div>
    </div>
  );
}
