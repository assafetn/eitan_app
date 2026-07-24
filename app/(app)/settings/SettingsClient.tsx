"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { COLOR_TOKENS, type ColorToken } from "@/lib/constants";
import type { FamilyMember, Label, Responsibility } from "@/lib/types";
import InstallHint from "@/components/ui/InstallHint";
import { ArrowRight, Check, ChevronLeft, Pencil, Plus, Trash2, Users, X } from "lucide-react";

interface Props {
  initialResponsibilities: Responsibility[];
  initialLabels: Label[];
  adults: FamilyMember[];
}

const RESP_OWNER_JOIN = "*, owner:family_members!responsibilities_owner_id_fkey(*)";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)",
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
  direction: "rtl",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

export default function SettingsClient({ initialResponsibilities, initialLabels, adults }: Props) {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(initialResponsibilities);
  const [labels, setLabels] = useState<Label[]>(initialLabels);

  const [respFormKey, setRespFormKey] = useState(0);
  const [labelFormKey, setLabelFormKey] = useState(0);
  const [editingRespId, setEditingRespId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  // ── responsibilities CRUD ──────────────────────────────
  async function createResponsibility(values: { name: string; owner_id: string; color: ColorToken | null }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("responsibilities")
      .insert({ name: values.name, owner_id: values.owner_id, color: values.color })
      .select(RESP_OWNER_JOIN)
      .single();
    if (error || !data) return false;
    setResponsibilities((prev) => [...prev, data as Responsibility]);
    setRespFormKey((k) => k + 1); // reset the add form
    return true;
  }

  async function updateResponsibility(id: string, values: { name: string; owner_id: string; color: ColorToken | null }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("responsibilities")
      .update({ name: values.name, owner_id: values.owner_id, color: values.color })
      .eq("id", id)
      .select(RESP_OWNER_JOIN)
      .single();
    if (error || !data) return false;
    setResponsibilities((prev) => prev.map((r) => (r.id === id ? (data as Responsibility) : r)));
    setEditingRespId(null);
    return true;
  }

  async function deleteResponsibility(r: Responsibility) {
    if (
      !window.confirm(
        `למחוק את האחריות "${r.name}"? משימות שמשויכות אליה לא יימחקו — הן יישארו ללא אחריות.`
      )
    )
      return;
    const supabase = createClient();
    setResponsibilities((prev) => prev.filter((x) => x.id !== r.id));
    // FK on tasks.responsibility_id is ON DELETE SET NULL — tasks survive unassigned.
    await supabase.from("responsibilities").delete().eq("id", r.id);
  }

  // ── labels CRUD ────────────────────────────────────────
  async function createLabel(values: { name: string; color: ColorToken | null }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("labels")
      .insert({ name: values.name, color: values.color })
      .select("*")
      .single();
    if (error || !data) return false;
    setLabels((prev) => [...prev, data as Label]);
    setLabelFormKey((k) => k + 1);
    return true;
  }

  async function updateLabel(id: string, values: { name: string; color: ColorToken | null }) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("labels")
      .update({ name: values.name, color: values.color })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return false;
    setLabels((prev) => prev.map((l) => (l.id === id ? (data as Label) : l)));
    setEditingLabelId(null);
    return true;
  }

  async function deleteLabel(l: Label) {
    if (
      !window.confirm(
        `למחוק את התווית "${l.name}"? היא תוסר מכל המשימות שמשויכות אליה. המשימות עצמן יישארו.`
      )
    )
      return;
    const supabase = createClient();
    setLabels((prev) => prev.filter((x) => x.id !== l.id));
    // task_labels rows cascade-delete via FK — tasks survive without this label.
    await supabase.from("labels").delete().eq("id", l.id);
  }

  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "var(--sp-6) var(--sp-4)", paddingTop: "var(--sp-8)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
        <Link
          href="/home"
          aria-label="חזרה"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--r-full)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          <ArrowRight size={18} strokeWidth={2} />
        </Link>
        <h1
          style={{
            fontFamily: "var(--font)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          הגדרות
        </h1>
      </div>

      {/* iOS-only, self-hiding once installed or dismissed. */}
      <InstallHint />

      {/* ── Section: family (moved off the bottom nav) ── */}
      <Section title="משפחה" subtitle="ניהול הילדים והמשימות המשויכות אליהם.">
        <Link
          href="/family"
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
            padding: "12px 14px",
            minHeight: 44,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--r-full)",
              background: "var(--jmh-blue-05)",
              color: "var(--jmh-blue)",
              flexShrink: 0,
            }}
          >
            <Users size={18} strokeWidth={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font)",
                fontSize: "var(--text-base)",
                fontWeight: 500,
                color: "var(--text-primary)",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ילדים ומשימות
            </p>
            <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "2px 0 0" }}>
              צפייה בכל ילד והמשימות הפתוחות שלו
            </p>
          </div>
          <ChevronLeft size={18} strokeWidth={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </Link>
      </Section>

      {/* ── Section A: responsibilities ── */}
      <Section title="אחריות" subtitle="תחומי אחריות של ההורים. כל משימה יכולה להשתייך לאחריות אחת.">
        <ResponsibilityForm
          key={`resp-add-${respFormKey}`}
          adults={adults}
          submitLabel="הוסף אחריות"
          onSubmit={createResponsibility}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", marginTop: "var(--sp-4)" }}>
          {responsibilities.length === 0 && <EmptyHint text="עדיין אין תחומי אחריות. אפשר ליצור אחד למעלה." />}
          {responsibilities.map((r) =>
            editingRespId === r.id ? (
              <div key={r.id} style={cardStyle}>
                <ResponsibilityForm
                  adults={adults}
                  initial={r}
                  submitLabel="שמירה"
                  onSubmit={(v) => updateResponsibility(r.id, v)}
                  onCancel={() => setEditingRespId(null)}
                />
              </div>
            ) : (
              <Row
                key={r.id}
                color={r.color}
                title={r.name}
                subtitle={r.owner?.name ?? "—"}
                onEdit={() => setEditingRespId(r.id)}
                onDelete={() => deleteResponsibility(r)}
              />
            )
          )}
        </div>
      </Section>

      {/* ── Section B: labels ── */}
      <Section title="תוויות" subtitle="תגיות חופשיות שאפשר להצמיד למשימות. אפשר לבחור כמה לכל משימה.">
        <LabelForm key={`label-add-${labelFormKey}`} submitLabel="הוסף תווית" onSubmit={createLabel} />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", marginTop: "var(--sp-4)" }}>
          {labels.length === 0 && <EmptyHint text="עדיין אין תוויות. אפשר ליצור אחת למעלה." />}
          {labels.map((l) =>
            editingLabelId === l.id ? (
              <div key={l.id} style={cardStyle}>
                <LabelForm
                  initial={l}
                  submitLabel="שמירה"
                  onSubmit={(v) => updateLabel(l.id, v)}
                  onCancel={() => setEditingLabelId(null)}
                />
              </div>
            ) : (
              <Row
                key={l.id}
                color={l.color}
                title={l.name}
                onEdit={() => setEditingLabelId(l.id)}
                onDelete={() => deleteLabel(l)}
              />
            )
          )}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "var(--sp-4)",
  boxShadow: "var(--shadow-sm)",
};

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--sp-8)" }}>
      <h2
        style={{
          fontFamily: "var(--font)",
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
          margin: "0 0 var(--sp-1)",
        }}
      >
        {title}
      </h2>
      <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "0 0 var(--sp-4)", lineHeight: 1.5 }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", padding: "var(--sp-4)", margin: 0 }}>
      {text}
    </p>
  );
}

function ColorDot({ color, size = 10 }: { color: string | null; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: color ? `var(--${color})` : "transparent",
        border: color ? "none" : "1.5px solid var(--border-strong)",
      }}
    />
  );
}

function Row({
  color,
  title,
  subtitle,
  onEdit,
  onDelete,
}: {
  color: string | null;
  title: string;
  subtitle?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "12px 14px" }}>
      <ColorDot color={color} size={12} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-base)", fontWeight: 500, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ fontFamily: "var(--font)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "2px 0 0" }}>{subtitle}</p>
        )}
      </div>
      <IconButton ariaLabel="עריכה" onClick={onEdit}>
        <Pencil size={15} strokeWidth={2} />
      </IconButton>
      <IconButton ariaLabel="מחיקה" onClick={onDelete} danger>
        <Trash2 size={15} strokeWidth={2} />
      </IconButton>
    </div>
  );
}

function IconButton({
  children,
  ariaLabel,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: "var(--r-sm)",
        background: "transparent",
        border: "none",
        color: "var(--text-muted)",
        cursor: "pointer",
        flexShrink: 0,
        transition: `background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "var(--jmh-coral-bg)" : "var(--jmh-blue-05)";
        e.currentTarget.style.color = danger ? "var(--jmh-coral)" : "var(--jmh-blue)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}

function ColorSwatches({ value, onChange }: { value: ColorToken | null; onChange: (c: ColorToken | null) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
      <span style={labelStyle}>צבע</span>
      <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        {/* "ללא" — no color */}
        <Swatch active={value === null} onClick={() => onChange(null)} color={null} ariaLabel="ללא צבע" />
        {COLOR_TOKENS.map((c) => (
          <Swatch key={c} active={value === c} onClick={() => onChange(c)} color={c} ariaLabel={c} />
        ))}
      </div>
    </div>
  );
}

function Swatch({ color, active, onClick, ariaLabel }: { color: ColorToken | null; active: boolean; onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: "var(--r-full)",
        background: color ? `var(--${color})` : "var(--surface)",
        border: color ? "none" : "1.5px solid var(--border-strong)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: active ? "0 0 0 2px var(--surface), 0 0 0 4px var(--jmh-blue)" : "none",
        transition: `box-shadow var(--dur-fast) var(--ease-out)`,
      }}
    >
      {/* checkmark on the "ללא" swatch when active, so its selection reads clearly */}
      {active && !color && <Check size={14} strokeWidth={2.5} style={{ color: "var(--text-secondary)" }} />}
    </button>
  );
}

function FormButtons({
  submitLabel,
  canSubmit,
  busy,
  onCancel,
}: {
  submitLabel: string;
  canSubmit: boolean;
  busy: boolean;
  onCancel?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-1)" }}>
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          flex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--sp-1)",
          padding: "10px var(--sp-4)",
          background: canSubmit ? "var(--jmh-blue)" : "var(--jmh-blue-30)",
          color: "white",
          borderRadius: "var(--r-full)",
          border: "none",
          fontFamily: "var(--font)",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: `background var(--dur-fast) var(--ease-out)`,
        }}
      >
        {!onCancel && <Plus size={15} strokeWidth={2} />}
        {busy ? "שומר..." : submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-1)",
            padding: "10px var(--sp-4)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            borderRadius: "var(--r-full)",
            border: "1px solid var(--border-strong)",
            fontFamily: "var(--font)",
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            cursor: "pointer",
          }}
        >
          <X size={15} strokeWidth={2} />
          ביטול
        </button>
      )}
    </div>
  );
}

// ── Responsibility add/edit form ──
function ResponsibilityForm({
  adults,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  adults: FamilyMember[];
  initial?: Responsibility;
  submitLabel: string;
  onSubmit: (values: { name: string; owner_id: string; color: ColorToken | null }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ownerId, setOwnerId] = useState<string>(initial?.owner_id ?? adults[0]?.id ?? "");
  const [color, setColor] = useState<ColorToken | null>((initial?.color as ColorToken | null) ?? null);
  const [busy, setBusy] = useState(false);

  const canSubmit = !!name.trim() && !!ownerId && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const ok = await onSubmit({ name: name.trim(), owner_id: ownerId, color });
    setBusy(false);
    if (!ok) return;
  }

  if (adults.length === 0) {
    return <EmptyHint text="לא נמצאו הורים במערכת. אי אפשר ליצור אחריות ללא בעלים." />;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <input
        placeholder="שם האחריות"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        <span style={labelStyle}>בעלים</span>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
        >
          {adults.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <ColorSwatches value={color} onChange={setColor} />

      <FormButtons submitLabel={submitLabel} canSubmit={canSubmit} busy={busy} onCancel={onCancel} />
    </form>
  );
}

// ── Label add/edit form ──
function LabelForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Label;
  submitLabel: string;
  onSubmit: (values: { name: string; color: ColorToken | null }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<ColorToken | null>((initial?.color as ColorToken | null) ?? null);
  const [busy, setBusy] = useState(false);

  const canSubmit = !!name.trim() && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    await onSubmit({ name: name.trim(), color });
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      <input
        placeholder="שם התווית"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      <ColorSwatches value={color} onChange={setColor} />
      <FormButtons submitLabel={submitLabel} canSubmit={canSubmit} busy={busy} onCancel={onCancel} />
    </form>
  );
}
