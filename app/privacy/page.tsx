import type { Metadata } from "next";

export const metadata: Metadata = { title: "מדיניות פרטיות · איתן" };

// Public page (no login): Google's OAuth consent screen links here.
// Plain and short on purpose — this is a private app for one household.

const h2: React.CSSProperties = {
  fontFamily: "var(--font)",
  fontSize: "var(--text-md)",
  fontWeight: 600,
  color: "var(--text-primary)",
  margin: "var(--sp-6) 0 var(--sp-2)",
};
const p: React.CSSProperties = {
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  lineHeight: 1.6,
  color: "var(--text-secondary)",
  margin: "0 0 var(--sp-2)",
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)", padding: "var(--sp-8) var(--sp-4)" }}>
      <article style={{ maxWidth: 640, margin: "0 auto" }}>
        <section dir="rtl">
          <h1 style={{ ...h2, fontSize: "var(--text-xl)", marginTop: 0 }}>מדיניות פרטיות – איתן</h1>
          <p style={p}>
            איתן הוא אפליקציה פרטית לניהול משימות ותזכורות של משפחה אחת. הגישה מוגבלת לשני חשבונות Google מורשים
            בלבד.
          </p>
          <h2 style={h2}>מה נשמר</h2>
          <p style={p}>
            הודעות הצ׳אט, המשימות והתזכורות שלכם, וכתובת המייל של חשבון Google שלכם. כשמחברים את יומן Google, נשמר גם
            אסימון גישה, מוצפן, כדי שאיתן יוכל לקרוא את היומן ולהוסיף אליו אירועים.
          </p>
          <h2 style={h2}>איך משתמשים ביומן</h2>
          <p style={p}>
            איתן קורא אירועים מהיומן כדי לענות על שאלות ולהכין את סיכום הבוקר. הוא מוסיף, משנה או מוחק אירוע רק לבקשה
            מפורשת שלכם (או בלחיצה על ״הוסף ליומן״), ורק באירועים שהוא עצמו יצר.
          </p>
          <h2 style={h2}>עם מי משותף</h2>
          <p style={p}>
            המידע לא נמכר ולא משמש לפרסום. כדי להבין את ההודעות, טקסט הצ׳אט ופרטי היומן הרלוונטיים נשלחים לעיבוד
            אצל Anthropic (מודל Claude). המידע נשמר ב-Supabase והאפליקציה רצה ב-Vercel.
          </p>
          <h2 style={h2}>ניתוק ומחיקה</h2>
          <p style={p}>
            בכל רגע אפשר לנתק את היומן בהגדרות. הניתוק מבטל את ההרשאה אצל Google ומוחק את האסימון. אפשר לבקש מבעל
            האפליקציה למחוק את כל המידע.
          </p>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "var(--sp-8) 0" }} />

        <section dir="ltr" lang="en">
          <h1 style={{ ...h2, fontSize: "var(--text-xl)", marginTop: 0 }}>Privacy policy – Eitan</h1>
          <p style={p}>
            Eitan is a private task and reminder app for a single household. Access is limited to two allow-listed
            Google accounts.
          </p>
          <p style={p}>
            <strong>Data stored:</strong> your chat messages, tasks and reminders, your Google account email, and —
            if you connect Google Calendar — an encrypted OAuth refresh token.
          </p>
          <p style={p}>
            <strong>Google Calendar:</strong> events are read to answer your questions and build the morning summary.
            Events are created, changed or deleted only when you explicitly ask, and only events the app itself
            created.
          </p>
          <p style={p}>
            <strong>Sharing:</strong> data is never sold or used for advertising. Chat text and relevant calendar
            details are processed by Anthropic (Claude) to understand your messages. Data is stored in Supabase; the
            app is hosted on Vercel.
          </p>
          <p style={p}>
            Eitan&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: "var(--jmh-blue)" }}>
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <p style={p}>
            <strong>Disconnect &amp; deletion:</strong> disconnect Google Calendar in Settings at any time — this
            revokes access at Google and deletes the stored token. You can ask the app owner to delete all data.
          </p>
        </section>
      </article>
    </main>
  );
}
