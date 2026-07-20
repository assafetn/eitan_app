export type MemberType = "adult" | "child";

// NOTE: TaskCategory was removed in Slice 7.1. The rigid category enum is
// replaced by the flexible Label system (see Label / task_labels below).

export type TaskStatus = "open" | "done";

export type TaskPriority = "low" | "normal" | "high";

// Week starts Sunday. sun = index 0 ... sat = index 6.
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

// Minimal recurrence shapes (v1): daily, or weekly on specific weekdays.
export type RecurrenceRule =
  | { freq: "daily" }
  | { freq: "weekly"; days: Weekday[] };

// A per-occurrence override is itself a row in `tasks` with a populated
// recurrence_parent_id and due_date = the occurrence date it overrides.
export interface OccurrenceOverride {
  id: string;
  recurrence_parent_id: string;
  due_date: string; // YYYY-MM-DD — the occurrence date this row overrides
  status: TaskStatus;
  // When this occurrence was completed. Drives the 3-day auto-hide of done
  // occurrences (display-only; the row is never deleted).
  completed_at: string | null;
}

export interface FamilyMember {
  id: string;
  name: string;
  type: MemberType;
  birthdate: string | null;
  color: string;
  avatar_url: string | null;
  auth_user_id: string | null;
  created_at: string;
}

// A top-level responsibility (אחריות) owned by an adult family member.
export interface Responsibility {
  id: string;
  name: string;
  owner_id: string;
  color: string | null; // design-token reference, nullable
  created_at: string;
  // joined
  owner?: FamilyMember | null;
}

// A flexible, user-addable tag. Replaces the old TaskCategory enum.
export interface Label {
  id: string;
  name: string;
  color: string | null; // design-token reference, nullable
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  responsibility_id: string | null;
  assignee_id: string | null;
  child_id: string | null;
  // When true, the task belongs to both adults — getTaskPeople resolves it to
  // all adults rather than a single owner/assignee.
  is_shared: boolean;
  due_date: string | null;
  due_time: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assignee?: FamilyMember | null;
  child?: FamilyMember | null;
  responsibility?: Responsibility | null;
  labels?: Label[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  is_checked: boolean;
  added_by: string;
  created_at: string;
  // joined
  adder?: FamilyMember | null;
}
