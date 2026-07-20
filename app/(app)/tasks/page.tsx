import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, Label, OccurrenceOverride, Responsibility, Task } from "@/lib/types";
import TasksClient from "./TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  // Primary rows = singles + recurring series parents (recurrence_parent_id is null).
  // Recurring parents are fetched regardless of status (we never complete the
  // parent itself); done singles are filtered out client-side.
  // Override rows (recurrence_parent_id not null) carry per-occurrence status.
  const [
    { data: tasks },
    { data: overrides },
    { data: members },
    { data: children },
    { data: responsibilities },
    { data: labels },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*), responsibility:responsibilities!tasks_responsibility_id_fkey(*, owner:family_members!responsibilities_owner_id_fkey(*)), labels(*)"
      )
      .is("recurrence_parent_id", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .not("recurrence_parent_id", "is", null),
    supabase
      .from("family_members")
      .select("*")
      .eq("type", "adult")
      .order("name"),
    supabase
      .from("family_members")
      .select("*")
      .eq("type", "child")
      .order("created_at", { ascending: true }),
    supabase
      .from("responsibilities")
      .select("*, owner:family_members!responsibilities_owner_id_fkey(*)")
      .order("created_at", { ascending: true }),
    supabase.from("labels").select("*").order("created_at", { ascending: true }),
  ]);

  const adults = (members as FamilyMember[]) ?? [];

  return (
    <TasksClient
      initialTasks={(tasks as Task[]) ?? []}
      initialOverrides={(overrides as OccurrenceOverride[]) ?? []}
      members={adults}
      childMembers={(children as FamilyMember[]) ?? []}
      responsibilities={(responsibilities as Responsibility[]) ?? []}
      labels={(labels as Label[]) ?? []}
      showFilter
      showViewToggle
    />
  );
}
