import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/currentUser";
import { redirect } from "next/navigation";
import { ALLOWED_EMAILS } from "@/lib/constants";
import TopTabs from "@/components/ui/TopTabs";
import AppShell from "@/components/ui/AppShell";
import { NavBadge } from "@/components/ui/NavBadges";
import RefreshOnFocus from "@/components/RefreshOnFocus";
import PushSync from "@/components/PushSync";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached per request and reused by the nav-badge counts and the page.
  // Verified locally (getClaims), so this costs no network round-trip.
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const email = user.email ?? "";
  if (!ALLOWED_EMAILS.includes(email)) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/no-access");
  }

  return (
    <>
      <RefreshOnFocus />
      <PushSync />
      {/* The tabs paint immediately; only the badge slot suspends (fallback
          null) and streams in. */}
      <AppShell
        tabs={
          <TopTabs
            tasksBadge={
              <Suspense fallback={null}>
                <NavBadge kind="tasks" inline />
              </Suspense>
            }
          />
        }
      >
        {children}
      </AppShell>
    </>
  );
}
