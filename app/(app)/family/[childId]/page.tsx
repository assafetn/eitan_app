import { createClient } from "@/lib/supabase/server";
import type { FamilyMember, OccurrenceOverride, Task } from "@/lib/types";
import { notFound } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import TasksClient from "@/app/(app)/tasks/TasksClient";

export const dynamic = "force-dynamic";

export default async function ChildTasksPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = await createClient();

  // The child's tasks depend only on childId (not on the other lookups), so they
  // join the same batch — one round-trip instead of two. Only the overrides
  // query below genuinely depends on the fetched task ids.
  const [
    { data: child },
    { data: members },
    { data: children },
    { data: tasks },
  ] = await Promise.all([
    supabase.from("family_members").select("*").eq("id", childId).eq("type", "child").single(),
    supabase.from("family_members").select("*").eq("type", "adult").order("name"),
    supabase.from("family_members").select("*").eq("type", "child").order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "*, assignee:family_members!tasks_assignee_id_fkey(*), child:family_members!tasks_child_id_fkey(*)"
      )
      .is("recurrence_parent_id", null)
      .eq("child_id", childId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!child) notFound();

  const parentIds = ((tasks as Task[]) ?? [])
    .filter((t) => t.recurrence_rule)
    .map((t) => t.id);

  let overrides: OccurrenceOverride[] = [];
  if (parentIds.length > 0) {
    const { data } = await supabase
      .from("tasks")
      .select("id, recurrence_parent_id, due_date, status, completed_at")
      .in("recurrence_parent_id", parentIds);
    overrides = (data as OccurrenceOverride[]) ?? [];
  }

  return (
    <TasksClient
      initialTasks={(tasks as Task[]) ?? []}
      initialOverrides={overrides}
      members={(members as FamilyMember[]) ?? []}
      childMembers={(children as FamilyMember[]) ?? []}
      title={(child as FamilyMember).name}
      back={<BackLink href="/family" label="משפחה" />}
      showAddButton={false}
      openOnly
    />
  );
}
