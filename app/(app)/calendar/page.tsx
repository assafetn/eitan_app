import { redirect } from "next/navigation";

// The calendar is no longer a separate tab — it's a view mode inside משימות.
// This route stays only to redirect any old bookmark/link to the list.
export default function CalendarPage() {
  redirect("/tasks");
}
