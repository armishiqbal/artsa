"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export const THEME_STORAGE_KEY = "artsa-theme";

interface ThemeContextValue {
  theme: Theme;
  /** Switch to a specific theme. */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Read the persisted choice, falling back to ARTSA's light-first product default. */
function storedTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable — fall through to system */
  }
  return "light";
}

/**
 * App theme provider. Applies `data-theme="dark|light"` to <html> so the CSS
 * token overrides in globals.css pick the palette, keeps the browser's
 * native color-scheme in sync, and persists the user's choice. ARTSA opens in
 * the light workspace unless the operator has previously selected dark mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Apply a stored choice after the light SSR default has painted.
  useEffect(() => {
    setThemeState(storedTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* non-persistent storage is fine */
    }
    // Keep the <meta name="viewport">-independent color-scheme meta in sync.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#070707" : "#f8fafc");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/** Safe theme hook that falls back to the product default outside ThemeProvider. */
export function useThemeSafe(): { theme: Theme; isDark: boolean; isLight: boolean } {
  const ctx = useContext(ThemeContext);
  const theme = ctx?.theme ?? "light";
  return {
    theme,
    isDark: theme === "dark",
    isLight: theme === "light",
  };
}
