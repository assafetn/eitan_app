import { SkelBar, SkelList, SkelPageShell } from "@/components/ui/Skeleton";

// The /calendar route server-redirects to /tasks (the calendar is a view mode
// inside משימות), so this only flashes momentarily. Kept lightweight and shaped
// like the tasks list it lands on, to avoid a jarring swap.
export default function CalendarLoading() {
  return (
    <SkelPageShell>
      <div style={{ marginBottom: "var(--sp-6)" }}>
        <SkelBar w="35%" h={28} radius="var(--r-md)" />
      </div>
      <SkelList count={5} />
    </SkelPageShell>
  );
}
