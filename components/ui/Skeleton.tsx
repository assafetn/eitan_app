// Shared skeleton primitives for route-loading placeholders. Pure server markup
// (no client hooks) so each loading.tsx paints instantly. Tokens only; the
// `.skeleton` class (globals.css) supplies the subtle pulse. Heights mirror the
// real screens so there is no layout shift when content arrives.
import type { CSSProperties, ReactNode } from "react";

export function SkelBar({
  w,
  h = 12,
  radius = "var(--r-sm)",
  style,
}: {
  w: string | number;
  h?: number;
  radius?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      style={{ display: "block", width: w, height: h, borderRadius: radius, background: "var(--border)", ...style }}
    />
  );
}

export function SkelCircle({ size = 20 }: { size?: number }) {
  return (
    <span
      className="skeleton"
      style={{ width: size, height: size, borderRadius: "50%", background: "var(--border)", flexShrink: 0 }}
    />
  );
}

// Mirrors the surface/border card shared by task, shopping and family rows:
// a leading circle + two stacked text lines.
export function SkelRowCard({ h }: { h?: number }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
        minHeight: h,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <SkelCircle size={20} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <SkelBar w="60%" h={12} />
        <SkelBar w="35%" h={10} />
      </span>
    </div>
  );
}

// The standard app page container (matches every tab's real container), so the
// skeleton occupies the same box and switching to real content doesn't shift.
export function SkelPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--sp-6) var(--sp-4)",
        paddingTop: "var(--sp-8)",
      }}
    >
      {children}
    </div>
  );
}

export function SkelList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkelRowCard key={i} />
      ))}
    </div>
  );
}
