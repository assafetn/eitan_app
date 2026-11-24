"use client";

// On each app open, re-registers this device's CURRENT push subscription with
// the server (once per page load). The server then replaces any older
// subscription for the same person and device, so a phone whose endpoint
// changed (e.g. the home-screen app was re-added) heals itself instead of
// silently missing reminders.
//
// It never creates a subscription or asks for permission: turning
// notifications on stays a deliberate tap in Settings (PushToggle).

import { useEffect } from "react";

let synced = false; // module scope: once per page load, across re-mounts

export default function PushSync() {
  useEffect(() => {
    if (synced) return;
    synced = true;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!sub) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...sub.toJSON(), sync: true }),
        });
      } catch {
        // Best effort: the next app open tries again.
      }
    })();
  }, []);

  return null;
}
