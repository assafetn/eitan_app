import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Label, OccurrenceOverride, Responsibility, Task } from "@/lib/types";
import { APP_NAME } from "@/lib/constants";
import HomeClient from "@/components/ui/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  // All queries run concurrently — getUser no longer gates the data queries. The
  // greeting name is derived from the already-fetched adults list (the logged-in
  // user is always an adult member), so there's no separate member query and no
  // extra round-trip. responsibilities/labels/children feed the (reused)
  // AddTaskModal opened from the "הוספת משימה" CTA. Note: responsibility.owner is
  // intentionally NOT joined on tasks — nothing on this screen reads it.
  const [
    { data: { user } },
    { data: tasks },
    { data: overrides },
    { data: adults },
    { data: children },
    { data: responsibilities },
    { data: labels },
  ] = await Promise.all([
    supabase.auth.getUser(),
    // All primary rows (singles + series parents) with joins — fed to the
    // shared occurrence engine that builds today's / upcoming tasks.
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*), responsibility:responsibilities!tasks_responsibility_id_fkey(*), labels(*)"
      )
      .is("recurrence_parent_id", null),
    supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .not("recurrence_parent_id", "is", null),
    supabase.from("family_members").select("*").eq("type", "adult").order("name"),
    supabase.from("family_members").select("*").eq("type", "child").order("created_at", { ascending: true }),
    supabase
      .from("responsibilities")
      .select("*, owner:family_members!responsibilities_owner_id_fkey(*)")
      .order("created_at", { ascending: true }),
    supabase.from("labels").select("*").order("created_at", { ascending: true }),
  ]);

  const adultList = (adults as FamilyMember[]) ?? [];
  const firstName = adultList.find((a) => a.auth_user_id === user?.id)?.name ?? null;

  return (
    <HomeClient
      appName={APP_NAME}
      firstName={firstName}
      initialTasks={(tasks as Task[]) ?? []}
      initialOverrides={(overrides as OccurrenceOverride[]) ?? []}
      adults={adultList}
      childMembers={(children as FamilyMember[]) ?? []}
      responsibilities={(responsibilities as Responsibility[]) ?? []}
      labels={(labels as Label[]) ?? []}
    />
  );
}
