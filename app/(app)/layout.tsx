import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ALLOWED_EMAILS } from "@/lib/constants";
import BottomNav from "@/components/ui/BottomNav";

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
        paddingBottom: 96, // space for bottom nav
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      <BottomNav />
    </div>
  );
}
