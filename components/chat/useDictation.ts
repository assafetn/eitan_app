"use client";

// Hebrew dictation with the phone's own speech recognition (Web Speech API).
// No server, no key, nothing recorded or stored: the words land in the
// message box and are sent like typed text.
//
// One utterance per tap (continuous = false): Android Chrome repeats words in
// continuous mode, and a pause ending the take is the familiar behaviour.
// Tapping again appends to what is already in the box.

import { useCallback, useEffect, useRef, useState } from "react";

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

export type DictationError = "denied" | "failed";

export function useDictation(opts: {
  /** Called with the full box text (what was there + what's been heard so far). */
  onText: (text: string) => void;
  onError: (kind: DictationError) => void;
}) {
  // Decided after mount so server and client render the same markup.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    setSupported(!!recognitionCtor());
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback((existing: string) => {
    const Ctor = recognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.continuous = false;
    rec.interimResults = true;

    const base = existing.trimEnd();
    rec.onresult = (e) => {
      let heard = "";
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
      heard = heard.trim();
      optsRef.current.onText(base && heard ? `${base} ${heard}` : base || heard);
    };
    rec.onerror = (e) => {
      // "no-speech" / "aborted" just end the take quietly.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") optsRef.current.onError("denied");
      else if (e.error !== "no-speech" && e.error !== "aborted") optsRef.current.onError("failed");
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      optsRef.current.onError("failed");
    }
  }, []);

  /** Stop listening; whatever was heard stays in the box. */
  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, start, stop };
}
