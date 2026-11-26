"use client";

// The app's only navigation: two tabs at the top (צ׳אט / משימות) and a
// settings gear. Replaces the old floating bottom nav and the home screen
// (docs/chat-redesign-plan.md, step 7). Family is reached from Settings.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

/** Height of the bar below the top safe area. */
export const TOP_TABS_HEIGHT = 52;

const tabs = [
  { id: "chat", href: "/chat", label: "צ׳אט" },
  { id: "tasks", href: "/tasks", label: "משימות" },
] as const;

export default function TopTabs({
  // Streamed server-rendered badge node (Suspense-wrapped by the layout), so
  // the tabs paint immediately and only the badge slot waits.
  tasksBadge,
}: {
  tasksBadge?: React.ReactNode;
}) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings") || pathname.startsWith("/family");

  return (
    <nav
      aria-label="ניווט ראשי"
      style={{
        // Part of the app frame (AppShell), above the scrolling content.
        position: "relative",
        zIndex: 50,
        flexShrink: 0,
        height: TOP_TABS_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: "0 var(--sp-4)",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* iOS-style segmented control: a quiet track, the current tab is a
          raised thumb (not a blue fill — blue is kept for actions). */}
      <div role="tablist" className="seg" style={{ flex: 1, maxWidth: 320, marginInline: "auto" }}>
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              className="seg-option"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
              {tab.id === "tasks" && tasksBadge}
            </Link>
          );
        })}
      </div>

      <Link
        href="/settings"
        aria-label="הגדרות"
        aria-current={settingsActive ? "page" : undefined}
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          marginInlineEnd: -6, // optical: the glyph, not its hit area, lines up with the edge
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--r-full)",
          color: settingsActive ? "var(--jmh-blue)" : "var(--text-secondary)",
          transition: "color var(--dur-fast) var(--ease-out)",
        }}
      >
        <Settings size={21} strokeWidth={settingsActive ? 2 : 1.7} />
      </Link>
    </nav>
  );
}
