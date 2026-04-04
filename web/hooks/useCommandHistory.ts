"use client";

import { useCallback, useEffect, useState } from "react";

const HISTORY_KEY = "donut-bot-cmd-history";
const MAX_HISTORY = 30;

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setHistory(parsed as string[]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const add = useCallback((cmd: string) => {
    setHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { history, add };
}
