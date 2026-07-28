"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applyTheme,
  prefersDarkQuery,
  readStoredTheme,
  storeTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  /** The stored preference — may be "system". */
  theme: Theme;
  /** What "system" currently collapses to; what's actually on <html>. */
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server render and first client render must agree, so both start at the
  // static default. The blocking <head> script has already stamped the real
  // theme on <html>, so this never causes a visible flash — only the settings
  // control briefly reads "system" before the mount effect below corrects it.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolved(applyTheme(stored));
  }, []);

  // Follow the OS only while the user hasn't pinned a theme.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = prefersDarkQuery();
    if (!mq) return;
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    storeTheme(next);
    setResolved(applyTheme(next));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
