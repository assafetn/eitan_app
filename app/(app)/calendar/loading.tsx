import { SkelGroup, SkelPageShell, SkelTitle } from "@/components/ui/Skeleton";

// The /calendar route server-redirects to /tasks (the calendar view no longer
// exists), so this only flashes momentarily. Kept lightweight and shaped like
// the tasks list it lands on, to avoid a jarring swap.
export default function CalendarLoading() {
  return (
    <SkelPageShell>
      <SkelTitle w="35%" />
      <SkelGroup count={4} />
    </SkelPageShell>
  );
}
