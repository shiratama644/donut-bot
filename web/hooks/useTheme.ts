"use client";

import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "donut-bot-theme";

export type Theme = "dark" | "light";

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let initial: Theme = "dark";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        initial = saved;
      } else {
        const prefersDark =
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
            : true;
        initial = prefersDark ? "dark" : "light";
      }
    } catch {
      // ignore
    }
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // ignore
      }
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
