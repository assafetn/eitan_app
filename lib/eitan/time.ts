// Date/time helpers for Eitan, always in Asia/Jerusalem. The server runs in
// UTC on Vercel, so nothing here may rely on the process's local timezone.

const TZ = "Asia/Jerusalem";

export const WEEKDAY_LETTER_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
export const WEEKDAY_NAME_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface JerusalemNow {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24h */
  time: string;
}

export function jerusalemNow(at: Date = new Date()): JerusalemNow {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour; // some engines render midnight as 24
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}` };
}

/** Add n days to YYYY-MM-DD (calendar arithmetic, timezone-free). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Accepts H:MM / HH:MM / HH:MM:SS; returns zero-padded HH:MM or null. */
export function normalizeTime(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * The one way Eitan states a date/time, e.g. "מחר, ג׳ 24.11 · 16:00".
 * Explicit day letter + day.month every time, so a wrong guess is obvious.
 */
export function formatWhen(date: string | null, time: string | null, today: string): string {
  if (!date) return time ? `בלי תאריך · ${time.slice(0, 5)}` : "בלי תאריך";
  const [y, m, d] = date.split("-");
  let out = `${WEEKDAY_LETTER_HE[weekdayIndex(date)]} ${Number(d)}.${Number(m)}`;
  if (y !== today.slice(0, 4)) out += `.${y}`;
  if (date === today) out = `היום, ${out}`;
  else if (date === addDays(today, 1)) out = `מחר, ${out}`;
  if (time) out += ` · ${time.slice(0, 5)}`;
  return out;
}
