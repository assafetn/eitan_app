import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// PWA assets must stay reachable WITHOUT a session:
//   manifest.webmanifest — the browser fetches it with credentials mode "omit"
//     (per the web app manifest spec), so middleware would see an anonymous
//     request, redirect to /login, and Chrome would try to JSON.parse HTML.
//   sw.js — service worker registration must still succeed after a session
//     expires, otherwise push dies silently.
//   icons/ — referenced by the manifest and likewise fetched without credentials.
//     (The image-extension rule below already covers today's .png files; the
//     explicit directory entry keeps that true for any future format.)
// Auth behaviour for every real app route is unchanged.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
