// Shared skeleton primitives for route-loading placeholders. Pure server markup
// (no client hooks) so each loading.tsx paints instantly. Tokens only; the
// `.skeleton` class (globals.css) supplies the subtle pulse. Shapes mirror the
// real screens (page title, inset groups) so nothing jumps when content lands.
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
      style={{ display: "block", width: w, height: h, borderRadius: radius, background: "var(--fill)", ...style }}
    />
  );
}

export function SkelCircle({ size = 20 }: { size?: number }) {
  return (
    <span
      className="skeleton"
      style={{ width: size, height: size, borderRadius: "50%", background: "var(--fill)", flexShrink: 0 }}
    />
  );
}

/** The standard page column (globals.css .page). */
export function SkelPageShell({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="page">
      {children}
    </div>
  );
}

/** A large page title, optionally with a back link above it. */
export function SkelTitle({ w = "40%", back = false }: { w?: string | number; back?: boolean }) {
  return (
    <div style={{ margin: back ? "0 0 var(--sp-6)" : "var(--sp-2) 0 var(--sp-5)" }}>
      {back && (
        <div style={{ height: 44, display: "flex", alignItems: "center", marginBottom: "var(--sp-1)" }}>
          <SkelBar w={64} h={14} />
        </div>
      )}
      <div style={{ height: 44, display: "flex", alignItems: "center" }}>
        <SkelBar w={w} h={28} radius="var(--r-md)" />
      </div>
    </div>
  );
}

/** One inset group (globals.css .group) of rows: a leading shape + two lines. */
export function SkelGroup({
  count = 3,
  lead = 22,
  rowHeight = 60,
  label = true,
}: {
  count?: number;
  /** Size of the leading circle (checkbox, avatar). */
  lead?: number;
  rowHeight?: number;
  label?: boolean;
}) {
  return (
    <div style={{ marginBottom: "var(--sp-6)" }}>
      {label && (
        <div style={{ margin: "0 var(--sp-1) var(--sp-2)" }}>
          <SkelBar w={56} h={12} />
        </div>
      )}
      <div className="group">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="group-row"
            style={
              {
                ["--row-inset" as string]: `${16 + lead + 12}px`,
                minHeight: rowHeight,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              } as CSSProperties
            }
          >
            <SkelCircle size={lead} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <SkelBar w={`${55 - (i % 3) * 10}%`} h={12} />
              <SkelBar w="32%" h={10} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
