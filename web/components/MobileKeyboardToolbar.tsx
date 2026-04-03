"use client";

import { useEffect, useState } from "react";

interface Props {
  visible: boolean;
  onTab: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
}

const BUTTONS = [
  { label: "Tab", key: "onTab" as const },
  { label: "↑",   key: "onArrowUp" as const },
  { label: "↓",   key: "onArrowDown" as const },
] as const;

// ソフトウェアキーボードが開いているときにその上にツールバーを表示する。
// visualViewport API でキーボード高さを取得し、bottom オフセットを調整する。
export default function MobileKeyboardToolbar({ visible, onTab, onArrowUp, onArrowDown }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);

  // タッチデバイス判定（マウント後に評価してSSRを回避）
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // visualViewport の変化からキーボード高さを計算してオフセットに反映する
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // キーボードが占有している高さ（ビューポートの底 - ビジュアルビューポートの底）
      const offset = window.innerHeight - (vv.offsetTop + vv.height);
      setBottomOffset(Math.max(0, offset));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  if (!isTouch || !visible) return null;

  const handlers = { onTab, onArrowUp, onArrowDown };

  return (
    <div
      role="toolbar"
      aria-label="キーボードツールバー"
      style={{
        position: "fixed",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        display: "flex",
        gap: 1,
        backgroundColor: "var(--color-border)",
        zIndex: 200,
      }}
    >
      {BUTTONS.map(({ label, key }) => (
        <button
          key={label}
          type="button"
          // onMouseDown で preventDefault してフォーカスを input から奪わない
          onMouseDown={(e) => e.preventDefault()}
          onClick={handlers[key]}
          style={{
            flex: 1,
            padding: "10px 0",
            backgroundColor: "var(--color-btn)",
            color: "var(--color-text)",
            border: "none",
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
