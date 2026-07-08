import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function NoAccessPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-6)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--r-full)",
          background: "var(--jmh-coral-bg)",
          border: "1px solid oklch(0.60 0.15 22 / 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--sp-4)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--jmh-coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      </div>

      <h1
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-xl)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          margin: "0 0 var(--sp-2)",
        }}
      >
        אין גישה
      </h1>
      <p
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-base)",
          color: "var(--text-secondary)",
          maxWidth: 280,
          lineHeight: 1.5,
          margin: "0 0 var(--sp-6)",
        }}
      >
        חשבון זה אינו מורשה להשתמש ב-{APP_NAME}. אנא פנה לאסף.
      </p>

      <Link
        href="/login"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "10px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "var(--text-primary)",
          textDecoration: "none",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        חזרה להתחברות
      </Link>
    </main>
  );
}
