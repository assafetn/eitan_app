"use client";

// Swipe a row sideways (either direction) to reveal a red "מחיקה" action.
// - A short swipe opens it; tap "מחיקה" to delete, or tap the row to close.
// - A long swipe (past half the row) deletes straight away.
// `onDelete` is expected to confirm (the task list shows its delete dialog).
//
// Pointer events cover touch and mouse. `touch-action: pan-y` leaves vertical
// scrolling to the browser; we only take over once the gesture is clearly
// horizontal, so scrolling the list never opens rows by accident.

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

const REVEAL = 88; // px the row slides to show the action
const DECIDE_PX = 8; // movement before we decide horizontal vs vertical

export default function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [x, setXState] = useState(0);
  // Mirror of x for handlers that run between renders.
  const xRef = useRef(0);
  const setX = (v: number) => {
    xRef.current = v;
    setXState(v);
  };
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const g = useRef<{
    id: number;
    startX: number;
    startY: number;
    baseX: number;
    mode: "pending" | "swipe" | "scroll";
    moved: boolean;
  } | null>(null);
  // Set when a gesture moved the row, so the click that follows it doesn't
  // also open the edit sheet.
  const swallowClick = useRef(false);

  const width = () => wrapRef.current?.offsetWidth ?? 320;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    g.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: xRef.current, mode: "pending", moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s || s.id !== e.pointerId || s.mode === "scroll") return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === "pending") {
      if (Math.abs(dy) > DECIDE_PX && Math.abs(dy) > Math.abs(dx)) {
        s.mode = "scroll";
        return;
      }
      if (Math.abs(dx) <= DECIDE_PX) return;
      s.mode = "swipe";
      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (keeps the drag if the finger leaves the row).
      }
    }
    s.moved = true;
    const max = width() * 0.75;
    setX(Math.max(-max, Math.min(max, s.baseX + dx)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = g.current;
    g.current = null;
    if (!s || s.id !== e.pointerId) return;
    setDragging(false);
    if (s.mode !== "swipe") return;
    swallowClick.current = s.moved;
    const w = width();
    const cur = xRef.current;
    if (Math.abs(cur) > w * 0.5) {
      setX(0);
      onDelete();
    } else if (Math.abs(cur) > REVEAL / 2) {
      setX(cur > 0 ? REVEAL : -REVEAL);
    } else {
      setX(0);
    }
  }

  function onClickCapture(e: React.MouseEvent) {
    // After a swipe, or while open: the tap closes instead of editing.
    if (swallowClick.current || xRef.current !== 0) {
      e.stopPropagation();
      e.preventDefault();
      swallowClick.current = false;
      setX(0);
    }
  }

  const actionSide = x > 0 ? "left" : "right"; // the side the row moved away from
  const open = x !== 0;

  return (
    <div ref={wrapRef} style={{ position: "relative", overflow: "hidden" }}>
      {/* The action underneath. Only interactive while revealed. */}
      <div
        aria-hidden={!open}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--jmh-coral)",
          visibility: open ? "visible" : "hidden",
        }}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setX(0);
            onDelete();
          }}
          style={{
            // Physical left/right (not flex start/end, which flip in RTL):
            // the button sits in the gap the row slid away from.
            position: "absolute",
            top: 0,
            bottom: 0,
            [actionSide]: 0,
            width: REVEAL,
            border: "none",
            background: "transparent",
            color: "var(--text-on-blue)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            fontFamily: "var(--font)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Trash2 size={18} strokeWidth={2} />
          מחיקה
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        style={{
          position: "relative",
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform var(--dur-base) var(--ease-out)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
