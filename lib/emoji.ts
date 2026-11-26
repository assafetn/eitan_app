// The emoji catalog: one emoji per kind of task, so Eitan's replies, the
// reminders he posts, push notifications and the task list all show at a
// glance what he understood ("🛒 לקנות חלב", "🦷 רופא שיניים לנועה").
//
// Eitan picks the key when he saves a task (create_task / update_task); it is
// stored as tasks.emoji_key (migration 024). Tasks without one (added by hand,
// or saved before the catalog existed) get a best guess from their title via
// the Hebrew words below, falling back to ⏰.
//
// Order matters for that guess: the first kind with a matching word wins, so
// specific kinds come before general ones (dentist before doctor, groceries
// before shopping). Keys are stored in the database: never rename or remove
// one — change its emoji, hint or words instead, or append a new kind.

export interface EmojiKind {
  key: string;
  emoji: string;
  /** What it covers — shown to Eitan in his instructions. */
  hint: string;
  /** Whole Hebrew words or phrases that suggest this kind in a task title
   *  (a prefix letter such as ל/ה/ב/ו before them is fine). */
  words: string[];
}

export const EMOJI_KINDS: readonly EmojiKind[] = [
  { key: "reminder", emoji: "⏰", hint: "a general reminder that fits nothing more specific", words: [] },
  { key: "groceries", emoji: "🛒", hint: "food / supermarket shopping", words: ["סופר", "מכולת", "חלב", "לחם", "ביצים", "ירקות", "פירות", "קניות", "רשימת קניות"] },
  { key: "gift", emoji: "🎁", hint: "a present to buy or wrap", words: ["מתנה", "מתנות"] },
  { key: "birthday", emoji: "🎂", hint: "a birthday or birthday party", words: ["יום הולדת", "יומולדת"] },
  { key: "party", emoji: "🎉", hint: "a party, celebration, wedding, holiday event", words: ["מסיבה", "חגיגה", "אירוע", "חתונה", "בר מצווה", "בת מצווה", "ברית"] },
  { key: "dentist", emoji: "🦷", hint: "the dentist or orthodontist", words: ["שיניים", "אורתודנט"] },
  { key: "doctor", emoji: "🩺", hint: "a doctor, clinic, check-up, tests, vaccine", words: ["רופא", "רופאה", "קופת חולים", "בדיקה", "בדיקות", "בדיקת", "חיסון", "מרפאה", "טיפת חלב"] },
  { key: "medicine", emoji: "💊", hint: "medicine to take or buy, the pharmacy, prescriptions", words: ["תרופה", "תרופות", "כדור", "כדורים", "מרשם", "בית מרקחת", "סופר פארם", "אנטיביוטיקה", "ויטמינים"] },
  { key: "school", emoji: "🎒", hint: "school, kindergarten, teachers, homework, parent meetings", words: ["בית ספר", "גן", "מורה", "גננת", "שיעורי בית", "אסיפת הורים", "צהרון"] },
  { key: "pickup", emoji: "🚸", hint: "picking up or dropping off a child", words: ["לאסוף", "איסוף", "הסעה"] },
  { key: "class", emoji: "⚽", hint: "a kid's class or after-school activity, sports, practice", words: ["חוג", "אימון", "כדורגל", "כדורסל", "שחייה", "התעמלות", "קראטה", "ריקוד", "בלט"] },
  { key: "music", emoji: "🎵", hint: "music lessons, instruments, concerts", words: ["פסנתר", "גיטרה", "תופים", "נגינה", "קונצרט", "הופעה"] },
  { key: "bill", emoji: "💳", hint: "paying a bill, payments, money transfers", words: ["לשלם", "תשלום", "חשבון חשמל", "חשבון מים", "ארנונה", "חשבונית"] },
  { key: "bank", emoji: "🏦", hint: "the bank, taxes, insurance, pension", words: ["בנק", "מס הכנסה", "ביטוח", "פנסיה", "ביטוח לאומי"] },
  { key: "paperwork", emoji: "📄", hint: "forms, documents, signing, renewing a license or passport", words: ["טופס", "טפסים", "לחתום", "מסמך", "מסמכים", "דרכון", "רישיון"] },
  { key: "call", emoji: "📞", hint: "a phone call to make", words: ["להתקשר", "לטלפן", "טלפון"] },
  { key: "message", emoji: "💬", hint: "a message or email to send, someone to update", words: ["הודעה", "מייל", "וואטסאפ", "לעדכן"] },
  { key: "meeting", emoji: "📅", hint: "a meeting or appointment that isn't medical", words: ["פגישה", "לקבוע", "תור"] },
  { key: "car", emoji: "🚗", hint: "the car: service, test, fuel, parking, car wash", words: ["רכב", "מכונית", "טסט", "מוסך", "דלק", "צמיגים", "חניה"] },
  { key: "repair", emoji: "🔧", hint: "something to fix at home: a technician, plumber, electrician", words: ["לתקן", "תיקון", "טכנאי", "אינסטלטור", "חשמלאי", "מזגן", "נזילה"] },
  { key: "laundry", emoji: "🧺", hint: "laundry, ironing, dry cleaning", words: ["כביסה", "כביסות", "לגהץ", "ניקוי יבש"] },
  { key: "cleaning", emoji: "🧹", hint: "cleaning and tidying the home", words: ["לנקות", "ניקיון", "לסדר", "לשטוף", "עוזרת"] },
  { key: "trash", emoji: "♻️", hint: "taking out the trash or recycling", words: ["זבל", "פח", "פחים", "מחזור"] },
  { key: "food_order", emoji: "🍕", hint: "ordering food or eating out", words: ["משלוח אוכל", "מסעדה", "פיצה", "וולט"] },
  { key: "cooking", emoji: "🍳", hint: "cooking, baking, a meal to plan", words: ["לבשל", "ארוחה", "ארוחת", "בישול", "לאפות", "עוגה"] },
  { key: "pet", emoji: "🐶", hint: "the pet: walk, vet, food", words: ["כלב", "חתול", "וטרינר"] },
  { key: "plants", emoji: "🌱", hint: "plants and the garden", words: ["עציצים", "להשקות", "גינה", "צמחים"] },
  { key: "books", emoji: "📚", hint: "books, the library, reading", words: ["ספרייה", "ספר", "ספרים"] },
  { key: "delivery", emoji: "📦", hint: "a package or delivery to send, collect or return", words: ["חבילה", "משלוח", "דואר", "להחזיר", "החזרה"] },
  { key: "travel", emoji: "✈️", hint: "a trip, flight, hotel, packing", words: ["טיסה", "חופשה", "מלון", "לארוז", "טיול"] },
  { key: "workout", emoji: "🏃", hint: "an adult's exercise: gym, running, yoga", words: ["חדר כושר", "ריצה", "יוגה", "פילאטיס", "כושר"] },
  { key: "haircut", emoji: "💇", hint: "haircut, beauty, grooming appointments", words: ["תספורת", "מספרה", "מניקור", "פדיקור", "קוסמטיקאית"] },
  { key: "baby", emoji: "🍼", hint: "baby care: formula, diapers, feeding", words: ["חיתולים", "מטרנה", "בקבוק", "תינוק", "תינוקת"] },
  { key: "family", emoji: "👨‍👩‍👧", hint: "visiting family or friends, a family get-together", words: ["סבא", "סבתא", "ההורים", "ביקור", "לבקר"] },
  { key: "shopping", emoji: "🛍️", hint: "buying things that aren't food (clothes, shoes, home items)", words: ["בגדים", "נעליים", "לקנות", "להזמין"] },
];

const BY_KEY = new Map(EMOJI_KINDS.map((k) => [k.key, k]));
export const EMOJI_KEYS = EMOJI_KINDS.map((k) => k.key);
export const DEFAULT_EMOJI = "⏰";

export function isEmojiKey(v: unknown): v is string {
  return typeof v === "string" && BY_KEY.has(v);
}

export function emojiForKey(key: string | null | undefined): string | null {
  return (key && BY_KEY.get(key)?.emoji) || null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole word (or phrase), with up to two Hebrew prefix letters before it.
const MATCHERS = EMOJI_KINDS.map((k) => ({
  key: k.key,
  res: k.words.map((w) => new RegExp(`(?:^|\\s)[והלבמשכ]{0,2}${escape(w)}(?=\\s|$)`, "u")),
}));

/** Best guess from a title: the first kind (in catalog order) with a match. */
export function guessEmojiKey(title: string): string | null {
  const t = title.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  for (const m of MATCHERS) if (m.res.some((re) => re.test(t))) return m.key;
  return null;
}

/** The emoji for a task: Eitan's choice, else a guess from the title, else ⏰. */
export function taskEmoji(task: { emoji_key?: string | null; title: string }): string {
  return emojiForKey(task.emoji_key) ?? emojiForKey(guessEmojiKey(task.title)) ?? DEFAULT_EMOJI;
}

/** The catalog as lines for Eitan's instructions: "groceries 🛒 — food shopping". */
export function emojiCatalogForPrompt(): string {
  return EMOJI_KINDS.map((k) => `${k.key} ${k.emoji} — ${k.hint}`).join("\n");
}
