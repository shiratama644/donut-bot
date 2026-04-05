"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
}

export default function SettingsPanel({ open, onClose, intervalMs, onIntervalChange }: Props) {
  return (
    <>
      {open && (
        <div
          className="settings-panel__overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`settings-panel ${open ? "settings-panel--open" : ""}`}
        aria-label="設定"
        role="complementary"
      >
        <div className="settings-panel__header">
          <span className="settings-panel__title">
            <span className="material-symbols-outlined settings-panel__title-icon">settings</span>
            設定
          </span>
          <button
            type="button"
            className="settings-panel__close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-panel__body">
          <div className="settings-panel__section-title">ステータス更新間隔</div>
          <div className="settings-panel__slider-row">
            <input
              type="range"
              min={10}
              max={5000}
              step={10}
              value={intervalMs}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="settings-panel__slider"
              aria-label="ステータス更新間隔"
            />
            <span className="settings-panel__slider-value">{intervalMs} ms</span>
          </div>
          <div className="settings-panel__slider-labels">
            <span>10 ms</span>
            <span>5000 ms</span>
          </div>
        </div>
      </aside>
    </>
  );
}
