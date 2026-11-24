import { redirect } from "next/navigation";

// The old home dashboard was retired (docs/chat-redesign-plan.md, step 7).
// Kept as a redirect so old bookmarks and installed apps that open /home
// land in the chat.
export default function HomePage() {
  redirect("/chat");
}
