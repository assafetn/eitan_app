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
  // Local signature check (see lib/currentUser.ts), no Auth round-trip.
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) redirect("/chat");

  const params = await searchParams;

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
        paddingTop: "max(var(--sp-6), env(safe-area-inset-top))",
        paddingBottom: "max(var(--sp-6), env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* The real app icon: the same charcoal tile as on the home screen. */}
        <img
          src="/apple-touch-icon.png"
          alt=""
          width={72}
          height={72}
          style={{ borderRadius: 18, boxShadow: "var(--shadow-md)", marginBottom: "var(--sp-6)" }}
        />

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl)",
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {APP_NAME}
        </h1>
        <p
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-base)",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            margin: "var(--sp-3) 0 var(--sp-10)",
          }}
        >
          המשימות והתזכורות של הבית,
          <br />
          בשיחה אחת.
        </p>

        {params.error && (
          <p
            role="alert"
            style={{
              width: "100%",
              fontFamily: "var(--font)",
              fontSize: "var(--text-sm)",
              color: "var(--jmh-coral)",
              background: "var(--jmh-coral-bg)",
              borderRadius: "var(--r-md)",
              padding: "var(--sp-2) var(--sp-3)",
              margin: "0 0 var(--sp-4)",
            }}
          >
            שגיאה בהתחברות. נסו שוב.
          </p>
        )}

        <LoginButton />

        <p
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-xs)",
            lineHeight: 1.5,
            color: "var(--text-muted)",
            margin: "var(--sp-4) 0 0",
          }}
        >
          התחברו עם חשבון ה-Google המשפחתי שלכם.
        </p>
      </div>
    </main>
  );
}
