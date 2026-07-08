import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Label, Responsibility } from "@/lib/types";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: responsibilities }, { data: labels }, { data: adults }] = await Promise.all([
    supabase
      .from("responsibilities")
      .select("*, owner:family_members!responsibilities_owner_id_fkey(*)")
      .order("created_at", { ascending: true }),
    supabase.from("labels").select("*").order("created_at", { ascending: true }),
    // owner-must-be-adult is a UI rule (the DB can't enforce it) — only adults
    // are offered as responsibility owners.
    supabase.from("family_members").select("*").eq("type", "adult").order("name"),
  ]);

  return (
    <SettingsClient
      initialResponsibilities={(responsibilities as Responsibility[]) ?? []}
      initialLabels={(labels as Label[]) ?? []}
      adults={(adults as FamilyMember[]) ?? []}
    />
  );
}
