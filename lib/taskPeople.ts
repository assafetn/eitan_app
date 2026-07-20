import type { FamilyMember, Task } from "@/lib/types";

// The single derived "who is on this task" concept: the ASSIGNED parent(s) only.
// Fixed precedence, pure (no DB calls, no side effects):
//
//   is_shared  -> both adults
//   assignee   -> [assignee]
//   otherwise  -> []   (no person shown; the responsibility owner is NOT a fallback)
//
// `adults` is only consulted for the shared case (to name both people); the
// joined assignee supplies its own FamilyMember for the single case.
export function getTaskPeople(task: Task, adults: FamilyMember[]): FamilyMember[] {
  if (task.is_shared) return adults;
  if (task.assignee) return [task.assignee];
  return [];
}
