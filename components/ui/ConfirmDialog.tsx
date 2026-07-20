"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  message: string;
  /** Label for the destructive/confirming action (coral button). */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Small reusable confirmation dialog. Centered over a dark scrim; Escape and a
// scrim tap both cancel; focus lands on the cancel button on open. Tokens only.
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe (cancel) action on open.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="presentation"
      onClick={onCancel} // scrim tap → cancel
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        // ~40–60% black; reuses the app's existing modal scrim value.
        background: "oklch(0.13 0.020 240 / 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-5)",
        direction: "rtl",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()} // clicks inside the panel don't cancel
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-md)",
          padding: "var(--sp-5)",
        }}
      >
        <h2
          id="confirm-dialog-title"
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            margin: "0 0 var(--sp-2)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-5)" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "0 var(--sp-4)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-full)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              cursor: "pointer",
              transition: `background var(--dur-fast) var(--ease-out)`,
            }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              minHeight: 44,
              padding: "0 var(--sp-4)",
              background: "var(--jmh-coral)",
              color: "white",
              border: "none",
              borderRadius: "var(--r-full)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)",
              transition: `background var(--dur-fast) var(--ease-out)`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
