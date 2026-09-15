import { redirect } from "next/navigation";

// The calendar view has been removed from the app entirely. This route stays
// only to redirect any old bookmark/link to the task list.
export default function CalendarPage() {
  redirect("/tasks");
}
