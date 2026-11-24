"use client";

// The app's only navigation: two tabs at the top (צ׳אט / משימות) and a
// settings gear. Replaces the old floating bottom nav and the home screen
// (docs/chat-redesign-plan.md, step 7). Family is reached from Settings.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

/** Height of the bar below the top safe area. */
export const TOP_TABS_HEIGHT = 56;

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
        gap: "var(--sp-2)",
        padding: "0 var(--sp-4)",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        role="tablist"
        style={{
          flex: 1,
          maxWidth: 360,
          marginInline: "auto",
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-full)",
        }}
      >
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              style={{
                flex: 1,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: "var(--r-full)",
                background: active ? "var(--jmh-blue)" : "transparent",
                color: active ? "var(--text-on-blue)" : "var(--text-secondary)",
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
                transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
              }}
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
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--r-full)",
          color: settingsActive ? "var(--jmh-blue)" : "var(--text-muted)",
          background: settingsActive ? "var(--jmh-blue-05)" : "transparent",
        }}
      >
        <Settings size={20} strokeWidth={1.8} />
      </Link>
    </nav>
  );
}
