"use client";

// Hebrew dictation with the phone's own speech recognition (Web Speech API).
// No server, no key, nothing recorded or stored: the words land in the
// message box and are sent like typed text.
//
// Phones end a recognition session after a short pause (and Android Chrome
// repeats words in `continuous` mode), so we run short sessions back to back:
// each one ends, its words are committed, and a new one starts at once, until
// the user taps stop or nothing has been heard for SILENCE_MS. One tap keeps
// listening through natural pauses.

import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_MS = 7000; // stop after this long with no new words
const MAX_MS = 120_000; // hard cap on one dictation
const RESTART_DELAY_MS = 120; // let the phone release the mic between sessions

// Minimal typings: the Web Speech API isn't in TypeScript's DOM lib.
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);

export type DictationError = "denied" | "failed";

export function useDictation(opts: {
  /** Called with the full box text (what was there + what's been heard so far). */
  onText: (text: string) => void;
  onError: (kind: DictationError, code?: string) => void;
}) {
  // Decided after mount so server and client render the same markup.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // One dictation = several back-to-back sessions; this is its shared state.
  const runRef = useRef<{
    wanted: boolean; // false once the user taps stop (or we give up)
    committed: string; // box text + words from finished sessions
    session: string; // words heard in the current session
    rec: Recognition | null;
    startedAt: number;
    lastHeardAt: number;
    sessions: number;
  } | null>(null);

  useEffect(() => {
    setSupported(!!recognitionCtor());
    return () => {
      const run = runRef.current;
      if (run) {
        run.wanted = false;
        run.rec?.abort();
      }
    };
  }, []);

  const finish = useCallback(() => {
    const run = runRef.current;
    if (run) {
      run.wanted = false;
      runRef.current = null;
    }
    setListening(false);
  }, []);

  const startSession = useCallback(() => {
    const run = runRef.current;
    const Ctor = recognitionCtor();
    if (!run || !run.wanted || !Ctor) return finish();

    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.continuous = false;
    rec.interimResults = true;
    run.rec = rec;
    run.session = "";
    run.sessions += 1;

    rec.onresult = (e) => {
      if (runRef.current !== run) return;
      let heard = "";
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
      heard = heard.trim();
      if (heard !== run.session) run.lastHeardAt = Date.now();
      run.session = heard;
      optsRef.current.onText(join(run.committed, heard));
    };
    rec.onerror = (e) => {
      if (runRef.current !== run) return;
      // Quiet ends: silence, our own abort. The silence timer decides when to stop.
      if (e.error === "no-speech" || e.error === "aborted") return;
      run.wanted = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Only the first session's refusal means "no permission". A later one
        // is the phone refusing an automatic restart: just stop, keep the text.
        if (run.sessions === 1) optsRef.current.onError("denied", e.error);
      } else {
        optsRef.current.onError("failed", e.error);
      }
    };
    rec.onend = () => {
      if (runRef.current !== run) return;
      run.committed = join(run.committed, run.session);
      run.session = "";
      run.rec = null;
      const now = Date.now();
      if (run.wanted && now - run.lastHeardAt < SILENCE_MS && now - run.startedAt < MAX_MS) {
        setTimeout(startSession, RESTART_DELAY_MS);
      } else {
        finish();
      }
    };

    try {
      rec.start();
    } catch {
      run.rec = null;
      if (run.sessions === 1) optsRef.current.onError("failed", "start");
      finish();
    }
  }, [finish]);

  const start = useCallback(
    (existing: string) => {
      if (runRef.current || !recognitionCtor()) return;
      const now = Date.now();
      runRef.current = {
        wanted: true,
        committed: existing.trimEnd(),
        session: "",
        rec: null,
        startedAt: now,
        lastHeardAt: now,
        sessions: 0,
      };
      setListening(true);
      startSession();
    },
    [startSession]
  );

  /** Stop listening; whatever was heard stays in the box. */
  const stop = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    run.wanted = false;
    if (run.rec) run.rec.stop(); // onend commits the last words, then finishes
    else finish();
  }, [finish]);

  return { supported, listening, start, stop };
}
