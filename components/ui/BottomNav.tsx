"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    id: "home",
    href: "/home",
    label: "בית",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "tasks",
    href: "/tasks",
    label: "משימות",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    id: "shopping",
    href: "/shopping",
    label: "קניות",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
] as const;
// NOTE: משפחה is intentionally not a nav tab — the /family route still exists and
// is reached from Settings (see SettingsClient). Three tabs, evenly distributed.

export default function BottomNav({
  tasksBadge,
  shoppingBadge,
}: {
  // Streamed server-rendered badge nodes (each Suspense-wrapped by the layout).
  // Passing them in as props keeps the nav painting immediately — only the badge
  // slots suspend.
  tasksBadge?: React.ReactNode;
  shoppingBadge?: React.ReactNode;
} = {}) {
  const pathname = usePathname();
  const badgeFor: Record<string, React.ReactNode> = { tasks: tasksBadge, shopping: shoppingBadge };

  return (
    <nav
      style={{
        position: "fixed",
        // Float above the home indicator: at least 14px, more on devices whose
        // safe-area inset is larger (viewport-fit:cover exposes it).
        bottom: "max(14px, env(safe-area-inset-bottom))",
        insetInlineStart: 14,
        insetInlineEnd: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        padding: 6,
        display: "flex",
        gap: "var(--sp-2)", // >=8px between the three tabs
        boxShadow: "var(--shadow-lg)",
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const badge = badgeFor[tab.id];
        return (
          <Link
            key={tab.id}
            href={tab.href}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              // column-reverse: icon stays visually on top, but the label comes
              // first in DOM so the streamed badge's screen-reader text (inside
              // the icon wrapper) is announced AFTER the label — "קניות, 3 פריטים".
              flexDirection: "column-reverse",
              alignItems: "center",
              gap: 3,
              padding: "8px 0",
              borderRadius: "var(--r-md)",
              background: isActive ? "var(--jmh-blue-05)" : "transparent",
              color: isActive ? "var(--jmh-blue)" : "var(--text-muted)",
              textDecoration: "none",
              transition: `background var(--dur-fast) var(--ease-out)`,
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: isActive ? 600 : 500,
                fontFamily: "var(--font)",
              }}
            >
              {tab.label}
            </span>
            {/* Icon wrapper is the badge's positioning context. No overflow set
                (default visible), so the corner badge is never clipped. */}
            <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
              {tab.icon}
              {badge}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
