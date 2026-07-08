"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--sp-2)",
        width: "100%",
        padding: "14px var(--sp-6)",
        background: loading ? "var(--jmh-blue-60)" : "var(--jmh-blue)",
        color: "white",
        borderRadius: "var(--r-full)",
        border: "none",
        fontFamily: "var(--font)",
        fontWeight: 600,
        fontSize: "var(--text-base)",
        cursor: loading ? "not-allowed" : "pointer",
        boxShadow: "var(--shadow-sm)",
        letterSpacing: "-0.01em",
        transition: `background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)`,
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--jmh-blue-80)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-md)";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--jmh-blue)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-sm)";
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
      }}
    >
      {/* Google G icon */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="white" fillOpacity="0.9"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="white" fillOpacity="0.8"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="white" fillOpacity="0.7"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="white" fillOpacity="0.9"/>
      </svg>
      {loading ? "מתחבר..." : "התחברות עם Google"}
    </button>
  );
}
