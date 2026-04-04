"use client";

import { useCallback, useEffect, useState } from "react";

const HISTORY_KEY = "donut-bot-msg-history";
/** 保存するメッセージ履歴の最大件数 */
const MAX_MESSAGE_HISTORY_SIZE = 30;

export function useMessageHistory() {
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

  const add = useCallback((msg: string) => {
    setHistory((prev) => {
      const next = [msg, ...prev.filter((m) => m !== msg)].slice(0, MAX_MESSAGE_HISTORY_SIZE);
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
