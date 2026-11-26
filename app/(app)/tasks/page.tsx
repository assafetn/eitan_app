import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, OccurrenceOverride, Task } from "@/lib/types";
import { getSessionMember } from "@/lib/currentUser";
import TasksClient from "./TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  // Everything in one parallel batch — the member lookup used to run first and
  // hold the four queries back by a full database round-trip.
  // Primary rows = singles + recurring series parents (recurrence_parent_id is null).
  // Recurring parents are fetched regardless of status (we never complete the
  // parent itself); done singles are filtered out client-side.
  // Override rows (recurrence_parent_id not null) carry per-occurrence status.
  const [
    me,
    { data: tasks },
    { data: overrides },
    { data: members },
    { data: children },
  ] = await Promise.all([
    getSessionMember(),
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*)"
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
  ]);

  const adults = (members as FamilyMember[]) ?? [];

  return (
    <TasksClient
      initialTasks={(tasks as Task[]) ?? []}
      initialOverrides={(overrides as OccurrenceOverride[]) ?? []}
      members={adults}
      childMembers={(children as FamilyMember[]) ?? []}
      myMemberId={me?.type === "adult" ? me.id : null}
    />
  );
}
