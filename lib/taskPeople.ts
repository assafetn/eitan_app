import type { FamilyMember, Task } from "@/lib/types";

// The single derived "who owns this task" concept. Collapses the old
// responsibility-owner + assignee pair into one resolved set of adults, in a
// fixed precedence order. Pure: no DB calls, no side effects.
//
//   is_shared        -> both adults
//   assignee         -> [assignee]
//   responsibility   -> [responsibility owner]
//   otherwise        -> []
//
// `adults` is only consulted for the shared case (to name both people); the
// joined assignee/owner supply their own FamilyMember for the single cases.
export function getTaskPeople(task: Task, adults: FamilyMember[]): FamilyMember[] {
  if (task.is_shared) return adults;
  if (task.assignee) return [task.assignee];
  if (task.responsibility?.owner) return [task.responsibility.owner];
  return [];
}
