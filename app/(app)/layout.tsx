import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ALLOWED_EMAILS } from "@/lib/constants";
import BottomNav from "@/components/ui/BottomNav";
import RefreshOnFocus from "@/components/RefreshOnFocus";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const email = user.email ?? "";
  if (!ALLOWED_EMAILS.includes(email)) {
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
      <BottomNav />
    </div>
  );
}
