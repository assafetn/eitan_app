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
      <img
        src="/apple-touch-icon.png"
        alt=""
        width={56}
        height={56}
        style={{ borderRadius: 14, boxShadow: "var(--shadow-sm)", marginBottom: "var(--sp-6)", opacity: 0.85 }}
      />

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          lineHeight: 1.1,
          color: "var(--text-primary)",
          margin: "0 0 var(--sp-3)",
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
          margin: "0 0 var(--sp-8)",
        }}
      >
        החשבון הזה אינו מורשה להשתמש ב{APP_NAME}. אנא פנו לאסף.
      </p>

      <Link
        href="/login"
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 44,
          padding: "0 20px",
          background: "var(--fill)",
          borderRadius: "var(--r-full)",
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--text-primary)",
          textDecoration: "none",
        }}
      >
        חזרה להתחברות
      </Link>
    </main>
  );
}
