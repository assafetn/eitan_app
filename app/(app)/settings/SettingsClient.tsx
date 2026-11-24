"use client";

import Link from "next/link";
import InstallHint from "@/components/ui/InstallHint";
import PushToggle from "@/components/ui/PushToggle";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { Theme } from "@/lib/theme";
import { ArrowRight, ChevronLeft, Monitor, Moon, Sun, Users } from "lucide-react";

// Settings: appearance, family (children) and notifications. Responsibilities
// and labels were removed — a task's only tag is its owner (אסף, נטלי or both).
export default function SettingsClient() {
  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "var(--sp-6) var(--sp-4)", paddingTop: "var(--sp-8)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        <Link
          href="/chat"
          aria-label="חזרה"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--r-full)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          <ArrowRight size={18} strokeWidth={2} />
        </Link>
        <h1
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          הגדרות
        </h1>
      </div>

      {/* iOS-only, self-hiding once installed or dismissed. */}
      <InstallHint />

      {/* ── Section: appearance ── */}
      <Section title="מראה" subtitle="בחירת ערכת הצבעים של האפליקציה. ההגדרה נשמרת במכשיר הזה בלבד.">
        <ThemeToggle />
      </Section>

      {/* ── Section: family (moved off the bottom nav) ── */}
      <Section title="משפחה" subtitle="ניהול הילדים והמשימות המשויכות אליהם.">
        <Link
          href="/family"
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
            padding: "12px 14px",
            minHeight: 44,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--r-full)",
              background: "var(--jmh-blue-05)",
              color: "var(--jmh-blue)",
              flexShrink: 0,
            }}
          >
            <Users size={18} strokeWidth={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-base)",
                fontWeight: 500,
                color: "var(--text-primary)",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ילדים ומשימות
            </p>
            <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "2px 0 0" }}>
              צפייה בכל ילד והמשימות הפתוחות שלו
            </p>
          </div>
          <ChevronLeft size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </Link>
      </Section>

      {/* ── Section: notifications ── */}
      <Section title="התראות" subtitle="קבלת התראות על משימות במכשיר הזה.">
        <div style={cardStyle}>
          <PushToggle />
        </div>
      </Section>

    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "var(--sp-4)",
  boxShadow: "var(--shadow-sm)",
};

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--sp-8)" }}>
      <h2
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
          margin: "0 0 var(--sp-1)",
        }}
      >
        {title}
      </h2>
      <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "0 0 var(--sp-4)", lineHeight: 1.5 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

// Appearance control. Same pill-track visual as the view/owner segmented
// controls in TasksClient, sized up to a 44px touch target via padding (not a
// fixed height) so it still grows with the user's text size.
const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "מערכת", icon: <Monitor size={15} strokeWidth={2} /> },
  { value: "light", label: "בהיר", icon: <Sun size={15} strokeWidth={2} /> },
  { value: "dark", label: "כהה", icon: <Moon size={15} strokeWidth={2} /> },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="ערכת צבעים"
      style={{
        display: "flex",
        width: "100%",
        padding: 3,
        gap: 3,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-full)",
      }}
    >
      {THEME_OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            style={{
              // equal widths + a weight that never changes → no reflow between
              // states, so tapping a segment can't shift the other two.
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--sp-1)",
              minHeight: 44,
              padding: "12px var(--sp-2)",
              borderRadius: "var(--r-full)",
              border: "none",
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--jmh-blue)" : "var(--text-muted)",
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: `all var(--dur-fast) var(--ease-out)`,
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
