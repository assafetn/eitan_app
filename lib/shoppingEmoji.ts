// Hebrew keyword → emoji dictionary for shopping-list item rows.
//
// This is the ONLY place emoji are allowed in the product UI (see CLAUDE.md
// design law — narrow shopping-list exception). The emoji is computed LIVE from
// the item name on render; nothing is stored in the DB, so improving this
// dictionary auto-updates every existing item.
//
// MATCHING CONTRACT (see getShoppingEmoji):
//  - Normalize the name: trim, collapse whitespace, strip a leading
//    quantity/unit run ("2", "1 ק\"ג", "3%", "500 גרם", "חצי", ...).
//  - Match on keyword PRESENCE anywhere in the normalized name (not equality).
//  - LONGEST / MOST-SPECIFIC keyword wins. We sort every keyword by length
//    descending ONCE at module load (SORTED below) — correctness does NOT rely
//    on object/array key order. This is why "גבינה צהובה" beats "גבינה",
//    "שמן זית" beats "שמן", "רסק עגבניות" beats "עגבניות", "סבון כלים" beats
//    "סבון", "לחם פרוס" beats "לחם".
//  - No match → DEFAULT_EMOJI (🛒).

export const DEFAULT_EMOJI = "🛒";

/** Map a list of keywords to one emoji (keeps the dictionary readable). */
function group(keywords: string[], emoji: string): [string, string][] {
  return keywords.map((k) => [k, emoji]);
}

// Order here is for human readability only — the matcher sorts by length below.
const ENTRIES: [string, string][] = [
  // מוצרי חלב וביצים
  ...group(["חלב"], "🥛"),
  ...group(
    ["גבינה צהובה", "גבינה לבנה", "גבינת שמנת", "גבינה", "גבינת", "קוטג'", "קוטג", "מוצרלה", "בולגרית", "פטה"],
    "🧀"
  ),
  ...group(["שמנת חמוצה", "שמנת"], "🍦"),
  ...group(["יוגורט", "יופלה", "דנונה", "לבן", "לבנה", "מעדן", "מעדנים"], "🥛"),
  ...group(["חמאה"], "🧈"),
  ...group(["ביצים", "ביצה"], "🥚"),

  // פירות
  ...group(["תפוח עץ", "תפוחים", "תפוח"], "🍎"),
  ...group(["בננות", "בננה"], "🍌"),
  ...group(["תפוזים", "תפוז", "קלמנטינה", "קלמנטינות", "מנדרינה", "אשכולית"], "🍊"),
  ...group(["לימונים", "לימון"], "🍋"),
  ...group(["ענבים"], "🍇"),
  ...group(["תותים", "תות"], "🍓"),
  ...group(["אבטיח"], "🍉"),
  ...group(["מלון"], "🍈"),
  ...group(["קיווי"], "🥝"),
  ...group(["אפרסק", "נקטרינה", "שזיף", "שזיפים"], "🍑"),
  ...group(["אגסים", "אגס"], "🍐"),
  ...group(["אננס"], "🍍"),
  ...group(["מנגו"], "🥭"),
  ...group(["דובדבן", "דובדבנים"], "🍒"),
  ...group(["אוכמניות"], "🫐"),
  ...group(["קוקוס"], "🥥"),
  ...group(["אבוקדו"], "🥑"),

  // ירקות
  ...group(["עגבניות", "עגבניה", "עגבנייה"], "🍅"),
  ...group(["מלפפונים", "מלפפון"], "🥒"),
  ...group(["בצל"], "🧅"),
  ...group(["שום"], "🧄"),
  ...group(["גזרים", "גזר"], "🥕"),
  ...group(["תפוחי אדמה", "תפוח אדמה", 'תפו"א'], "🥔"),
  ...group(["בטטה", "בטטות"], "🍠"),
  ...group(["חסה", "כרוב", "תרד"], "🥬"),
  ...group(["ברוקולי", "כרובית"], "🥦"),
  ...group(["פלפל חריף", "פלפל"], "🌶️"),
  ...group(["פלפל אדום", "גמבה"], "🫑"),
  ...group(["חציל", "חצילים"], "🍆"),
  ...group(["קישוא", "קישואים", "זוקיני"], "🥒"),
  ...group(["דלעת", "דלורית"], "🎃"),
  ...group(["תירס"], "🌽"),
  ...group(["פטריות", "פטריה"], "🍄"),
  ...group(["פטרוזיליה", "כוסברה", "נענע", "בזיליקום"], "🌿"),
  ...group(["סלט"], "🥗"),
  ...group(["ג'ינג'ר", "זנגביל"], "🫚"),

  // בשר עוף דגים
  ...group(["חזה עוף", "שניצל", "עוף"], "🍗"),
  ...group(["אנטריקוט", "סטייק", "בקר", "בשר"], "🥩"),
  ...group(["כבש", "טלה"], "🍖"),
  ...group(["נקניקיות", "נקניק"], "🌭"),
  ...group(["סלמון", "דניס", "דגים", "דג", "טונה"], "🐟"),
  ...group(["שרימפס", "פירות ים"], "🍤"),

  // מאפים ודגנים
  ...group(["לחם פרוס", "לחם אחיד", "לחם לבן", "לחם"], "🍞"),
  ...group(["באגט", "לחמניות", "לחמניה"], "🥖"),
  ...group(["פיתות", "פיתה", "טורטיה", "לאפה"], "🫓"),
  ...group(["בייגלה", "בייגל", "חלה"], "🥨"),
  ...group(["ספגטי", "מקרוני", "אטריות", "פסטה"], "🍝"),
  ...group(["אורז"], "🍚"),
  ...group(["קמח", "קוסקוס", "בורגול", "קינואה"], "🌾"),
  ...group(["קורנפלקס", "דגני בוקר", "גרנולה"], "🥣"),
  ...group(["פיצה"], "🍕"),

  // מזווה ובישול
  ...group(["שמן זית", "שמן קנולה", "שמן"], "🫒"),
  ...group(["מלח", "פלפל שחור", "אבקת מרק", "מרק", "פפריקה", "כורכום", "כמון", "תבלינים"], "🧂"),
  ...group(["סוכר"], "🍬"),
  ...group(["דבש"], "🍯"),
  ...group(["ריבה"], "🫙"),
  ...group(["חמאת בוטנים", "ממרח"], "🥜"),
  ...group(["ממרח שוקולד", "נוטלה", "שחר"], "🍫"),
  ...group(["רסק עגבניות", "רסק", "שימורים", "מיונז"], "🥫"),
  ...group(["קטשופ"], "🍅"),
  ...group(["חרדל"], "🧉"),
  ...group(["חומץ"], "🍶"),
  ...group(["רוטב סויה", "סויה"], "🌶️"),
  ...group(["שמרים", "אבקת אפיה", "וניל"], "🧁"),
  ...group(["ג'לי", "פודינג"], "🍮"),

  // חטיפים ומתוקים
  ...group(["שוקולד", "קרמבו"], "🍫"),
  ...group(["עוגיות", "עוגיה", "ביסקוויט"], "🍪"),
  ...group(["עוגה"], "🎂"),
  ...group(["במבה", "פופקורן"], "🍿"),
  ...group(["ביסלי"], "🥨"),
  ...group(["תפוצ'יפס", "צ'יפס"], "🥔"),
  ...group(["סוכריה על מקל"], "🍭"),
  ...group(["סוכריות", "ממתקים", "סוכרייה"], "🍬"),
  ...group(["סופגניה", "דונאט"], "🍩"),
  ...group(["וופלים", "ופל"], "🧇"),
  ...group(["שקדים", "בוטנים", "אגוזים", "פיצוחים", "גרעינים"], "🥜"),

  // משקאות
  ...group(["מים מינרלים", "בקבוק מים", "מים"], "💧"),
  ...group(["קוקה קולה", "משקה מוגז", "ספרייט", "קולה", "סודה", "דיאט"], "🥤"),
  ...group(["מיץ תפוזים", "מיץ ענבים", "מיץ"], "🧃"),
  ...group(["נס קפה", "קפה"], "☕"),
  ...group(["תה", "חליטה"], "🍵"),
  ...group(["שוקו"], "🥛"),
  ...group(["יין"], "🍷"),
  ...group(["בירה"], "🍺"),
  ...group(["שמפניה", "פרוסקו"], "🍾"),
  ...group(["משקה אנרגיה", "רד בול"], "🧉"),

  // ניקיון ובית
  ...group(["נייר טואלט", "נייר מטבח", "מגבת נייר", "טואלט"], "🧻"),
  ...group(["סבון כלים", "סבון"], "🧼"),
  ...group(["נוזל כלים", "פיירי", "אקונומיקה", "מלבין", "מרכך כביסה", "מטהר אוויר"], "🧴"),
  ...group(["ספוגים", "ספוג", "סקוטש"], "🧽"),
  ...group(["טבליות כביסה", "אבקת כביסה"], "🧺"),
  ...group(["מטאטא", "מגב"], "🧹"),
  ...group(["סמרטוט", "דלי"], "🪣"),
  ...group(["שקיות אשפה", "שקיות זבל", "שקית"], "🗑️"),
  ...group(["צלחות חד פעמי", "כלים חד פעמיים", "כוסות חד פעמי"], "🍽️"),
  ...group(['סכו"ם', "כפיות", "מזלגות"], "🥄"),
  ...group(["נייר אפיה", "נייר כסף", "רדיד אלומיניום", "ניילון נצמד"], "🧯"),
  ...group(["סוללות", "בטריות"], "🔋"),
  ...group(["נורה", "נורות"], "💡"),
  ...group(["נרות", "נר"], "🕯️"),

  // טואלטיקה ופארם
  ...group(["משחת שיניים", "מברשת שיניים"], "🪥"),
  ...group(
    ["שמפו לתינוק", "שמפו", "מרכך שיער", "דאודורנט", "דיאו", "קרם הגנה", "קרם ידיים", "קרם גוף", "קרם", "מי פה", "ליסטרין"],
    "🧴"
  ),
  ...group(["ג'ל רחצה", "סבון גוף"], "🧼"),
  ...group(["טמפונים", "תחבושות", "פדים", "ממחטות", "טישו"], "🧻"),
  ...group(["סכין גילוח", "ג'ילט", "קצף גילוח"], "🪒"),
  ...group(["אקמול", "נורופן", "אדויל", "תרופות", "ויטמינים", "ויטמין", "ברזל"], "💊"),
  ...group(["פלסטר", "אגד"], "🩹"),

  // תינוקות
  ...group(["חיתולים", "טיטולים", "חיתול", "מטרנה", "סימילק", "תחליף חלב", 'תמ"ל', "בקבוקים", "בקבוק"], "🍼"),
  ...group(["מגבונים לחים", "מגבונים", "משחת החתלה"], "🧴"),
  ...group(["מחית", "אוכל לתינוק", "גרבר"], "🥄"),
  ...group(["מוצץ"], "🧷"),
  ...group(["צעצועים", "צעצוע"], "🧸"),

  // intentional 🛒 — no suitable emoji (mapped on purpose, not a gap)
  ...group(
    ["תמרים", "תמר", "רימון", "חומוס", "טחינה", "תאנים", "סלק", "אפונה", "טופו", "שעועית", "עדשים", "קטניות"],
    "🛒"
  ),
];

// Sort by keyword length DESCENDING so the longest/most-specific match wins.
// Stable tiebreak on original index keeps the result deterministic regardless
// of engine sort behavior.
const SORTED: [string, string][] = ENTRIES.map((e, i) => ({ e, i }))
  .sort((a, b) => b.e[0].length - a.e[0].length || a.i - b.i)
  .map(({ e }) => e);

// Quantity/unit words stripped from the START of a name before matching.
// Deliberately excludes words that are themselves product keywords (e.g.
// "בקבוק", "כוס", "שקית") so we don't strip a real item to nothing.
const LEADING_UNITS = new Set<string>([
  'ק"ג', "קג", "קילו", "ק'", "גרם", "גר'", "ג'", "ליטר", "ליטרים", "ל'",
  'מ"ל', "מל", 'סמ"ק', "יח'", "יחידה", "יחידות", "אריזה", "אריזת",
  "חבילה", "חבילת", "חפיסה", "חפיסת", "מארז", "מארזי", "חצי", "רבע", "שליש",
]);

const NUMERIC = /^\d+([.,]\d+)?%?$/; // "2", "500", "1.5", "2,5", "3%"

function normalize(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ").toLowerCase();
  // Strip a leading run of glued numbers like "2ק..." down to a clean number,
  // then peel leading quantity/unit tokens.
  const tokens = s.split(" ");
  while (tokens.length > 1) {
    const t = tokens[0];
    if (NUMERIC.test(t) || LEADING_UNITS.has(t)) tokens.shift();
    else break;
  }
  s = tokens.join(" ");
  // A leading number glued to the first kept token (e.g. "3%מיונז") — drop it.
  s = s.replace(/^\d+([.,]\d+)?%?\s*/, "");
  return s.trim();
}

/**
 * Infer a single leading emoji for a shopping-list item from its Hebrew name.
 * Pure function of the name — safe to call live on every render.
 */
export function getShoppingEmoji(itemName: string): string {
  if (!itemName) return DEFAULT_EMOJI;
  const name = normalize(itemName);
  if (!name) return DEFAULT_EMOJI;
  for (const [keyword, emoji] of SORTED) {
    if (name.includes(keyword)) return emoji;
  }
  return DEFAULT_EMOJI;
}

/** Total keyword count — exposed for diagnostics/tests. */
export const KEYWORD_COUNT = ENTRIES.length;
