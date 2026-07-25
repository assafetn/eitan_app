import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only. web-push signs with Node crypto, so anything importing this must
// run on the Node runtime (never Edge).

const VAPID_SUBJECT = process.env.VAPID_SUBJECT;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Fail loudly at import rather than silently no-op'ing every send later.
if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  const missing = [
    !VAPID_SUBJECT && "VAPID_SUBJECT",
    !VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    !VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `Web Push is not configured — missing environment variable(s): ${missing}. ` +
      `Set them in .env.local locally and in Vercel → Settings → Environment Variables.`
  );
}

// Configure once at module scope; the module is cached per server instance.
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export type PushResult = { sent: number; failed: number; pruned: number };

/**
 * Deliver one payload to every device registered for a member.
 *
 * The Supabase client is INJECTED so this works both with the request's session
 * client (the test route) and with a service-role client (the Step 4 cron),
 * without this module having to know which.
 *
 * Never throws: a single dead device must not abort delivery to the others.
 * A 404/410 means the endpoint is gone for good, so the row is deleted —
 * without pruning, expired endpoints fail on every future run forever.
 */
export async function sendPushToMember(
  supabase: SupabaseClient,
  memberId: string,
  payload: PushPayload
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);

  if (error) {
    console.error("[push] could not load subscriptions:", error.message);
    return result;
  }
  if (!subs || subs.length === 0) return result;

  const body = JSON.stringify(payload);

  await Promise.all(
    (subs as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        result.sent += 1;
        await supabase
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Gone / expired — drop it so it stops being retried forever.
          result.pruned += 1;
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          result.failed += 1;
          console.error(
            `[push] send failed (status ${statusCode ?? "unknown"}) for ${sub.endpoint.slice(0, 40)}…`,
            err
          );
        }
      }
    })
  );

  return result;
}
