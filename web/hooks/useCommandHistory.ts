"use client";

import { useCallback, useEffect, useState } from "react";

const HISTORY_KEY = "donut-bot-cmd-history";
const MAX_HISTORY = 30;

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as string[]);
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
