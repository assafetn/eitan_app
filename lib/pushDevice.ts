// Coarse device class for a push subscription, from its user agent. Used to
// keep ONE subscription per person per kind of device: when a phone registers
// again (e.g. the home-screen app was re-added), its old endpoint can stay
// "valid" at Apple (201 on send) while never reaching the phone, so it must be
// replaced rather than kept alongside the new one.

export type DeviceClass = "iphone" | "ipad" | "android" | "windows" | "mac" | "other";

export function deviceClass(userAgent: string | null | undefined): DeviceClass {
  const ua = userAgent ?? "";
  if (/iphone|ipod/i.test(ua)) return "iphone";
  if (/ipad/i.test(ua)) return "ipad";
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  return "other";
}

/** The push service an endpoint belongs to, e.g. "https://web.push.apple.com". */
export function pushService(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return "";
  }
}
