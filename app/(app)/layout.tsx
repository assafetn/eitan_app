import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/currentUser";
import { redirect } from "next/navigation";
import { ALLOWED_EMAILS } from "@/lib/constants";
import TopTabs from "@/components/ui/TopTabs";
import { NavBadge } from "@/components/ui/NavBadges";
import RefreshOnFocus from "@/components/RefreshOnFocus";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached per request and reused by the nav-badge counts (no second getUser).
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const email = user.email ?? "";
  if (!ALLOWED_EMAILS.includes(email)) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/no-access");
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        // viewport-fit:cover puts content under the notch/home indicator, so pad
        // by the safe-area insets.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <RefreshOnFocus />
      {/* The tabs paint immediately; only the badge slot suspends (fallback
          null) and streams in. */}
      <TopTabs
        tasksBadge={
          <Suspense fallback={null}>
            <NavBadge kind="tasks" inline />
          </Suspense>
        }
      />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
