"use client";

import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import InstallHint from "@/components/ui/InstallHint";
import PushToggle from "@/components/ui/PushToggle";
import { useTheme } from "@/components/ui/ThemeProvider";
import type { Theme } from "@/lib/theme";
import { ChevronLeft, Monitor, Moon, Sun, Users } from "lucide-react";

// Settings: appearance, family (children) and notifications, as inset grouped
// sections (globals.css .group). Responsibilities and labels were removed — a
// task's only tag is its owner (אסף, נטלי or both).
export default function SettingsClient() {
  return (
    <div className="page">
      <BackLink href="/chat" label="צ׳אט" />
      <h1 className="page-title" style={{ margin: "var(--sp-1) 0 var(--sp-6)" }}>
        הגדרות
      </h1>

      {/* iOS-only, self-hiding once installed or dismissed. */}
      <InstallHint />

      <Section title="מראה" note="ההגדרה נשמרת במכשיר הזה בלבד.">
        <ThemeToggle />
      </Section>

      <Section title="משפחה">
        <div className="group">
          <Link
            href="/family"
            className="group-row group-row--tap"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              minHeight: 60,
              padding: "10px 16px",
              textDecoration: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "var(--r-md)",
                background: "var(--jmh-blue-05)",
                color: "var(--jmh-blue)",
                flexShrink: 0,
              }}
            >
              <Users size={17} strokeWidth={2} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font)",
                  fontSize: "var(--text-base)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                ילדים ומשימות
              </span>
              <span style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                כל ילד והמשימות הפתוחות שלו
              </span>
            </span>
            <ChevronLeft size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </Link>
        </div>
      </Section>

      <Section title="התראות" note="ההתראות מגיעות למכשיר הזה בלבד.">
        <div className="group" style={{ padding: "6px 16px" }}>
          <PushToggle />
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--sp-8)" }}>
      <h2 className="group-label">{title}</h2>
      {children}
      {note && <p className="group-note">{note}</p>}
    </section>
  );
}

// Appearance control: the same segmented control as the top tabs, a little
// taller here since it's the only control in its section.
const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "מערכת", icon: <Monitor size={15} strokeWidth={2} /> },
  { value: "light", label: "בהיר", icon: <Sun size={15} strokeWidth={2} /> },
  { value: "dark", label: "כהה", icon: <Moon size={15} strokeWidth={2} /> },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="ערכת צבעים" className="seg">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          className="seg-option"
          aria-checked={theme === opt.value}
          onClick={() => setTheme(opt.value)}
          style={{ minHeight: 40 }}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
