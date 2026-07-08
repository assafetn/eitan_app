import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginButton from "./LoginButton";
import { APP_NAME } from "@/lib/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  const params = await searchParams;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: `radial-gradient(ellipse 100% 50% at 50% 0%, var(--jmh-blue-10) 0%, var(--bg) 68%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-6)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--sp-8)",
        }}
      >
        {/* Logo mark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-4)" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "var(--r-lg)",
              background: "var(--jmh-blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 9C8 9 10 7 16 7C22 7 24 9 24 9"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="10" cy="16" r="3" fill="white" fillOpacity="0.9" />
              <circle cx="22" cy="16" r="3" fill="white" fillOpacity="0.9" />
              <circle cx="13" cy="22" r="2" fill="white" fillOpacity="0.6" />
              <circle cx="19" cy="22" r="2" fill="white" fillOpacity="0.6" />
            </svg>
          </div>

          <div style={{ textAlign: "center" }}>
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
              {APP_NAME}
            </h1>
            <p
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: "var(--sp-1) 0 0",
              }}
            >
              לוח בקרה משפחתי
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "var(--sp-6)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-4)",
          }}
        >
          {params.error && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--jmh-coral)",
                background: "var(--jmh-coral-bg)",
                border: "1px solid oklch(0.60 0.15 22 / 0.25)",
                borderRadius: "var(--r-sm)",
                padding: "var(--sp-2) var(--sp-3)",
                margin: 0,
              }}
            >
              שגיאה בהתחברות. נסה שוב.
            </p>
          )}

          <p
            style={{
              fontFamily: "var(--font)",
              fontSize: "var(--text-base)",
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            התחבר עם חשבון Google המשפחתי שלך.
          </p>

          <LoginButton />
        </div>
      </div>
    </main>
  );
}
