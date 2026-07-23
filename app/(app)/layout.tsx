import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/currentUser";
import { redirect } from "next/navigation";
import { ALLOWED_EMAILS } from "@/lib/constants";
import BottomNav from "@/components/ui/BottomNav";
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
        // by the safe-area insets. Bottom also reserves room for the floating nav.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
      }}
    >
      <RefreshOnFocus />
      <div style={{ flex: 1 }}>{children}</div>
      {/* The nav paints immediately; only the badge slots suspend (fallback null)
          and stream in. The two NavBadge renders share one cached Promise.all. */}
      <BottomNav
        tasksBadge={
          <Suspense fallback={null}>
            <NavBadge kind="tasks" />
          </Suspense>
        }
        shoppingBadge={
          <Suspense fallback={null}>
            <NavBadge kind="shopping" />
          </Suspense>
        }
      />
    </div>
  );
}
