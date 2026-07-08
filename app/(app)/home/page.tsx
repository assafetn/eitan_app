import { createClient } from "@/lib/supabase/server";
import type { OccurrenceOverride, Task } from "@/lib/types";
import { APP_NAME } from "@/lib/constants";
import HomeClient from "@/components/ui/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: member }, { data: tasks }, { data: overrides }] = await Promise.all([
    user
      ? supabase.from("family_members").select("name").eq("auth_user_id", user.id).single()
      : Promise.resolve({ data: null }),
    // All primary rows (singles + series parents) with joins — fed to the
    // shared occurrence engine that builds today's / upcoming tasks.
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*), responsibility:responsibilities!tasks_responsibility_id_fkey(*, owner:family_members!responsibilities_owner_id_fkey(*)), labels(*)"
      )
      .is("recurrence_parent_id", null),
    supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .not("recurrence_parent_id", "is", null),
  ]);

  return (
    <HomeClient
      appName={APP_NAME}
      firstName={(member as { name: string } | null)?.name ?? null}
      initialTasks={(tasks as Task[]) ?? []}
      initialOverrides={(overrides as OccurrenceOverride[]) ?? []}
    />
  );
}
