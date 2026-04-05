"use client";

import type { BotStatusMessage } from "@/types/bot";

interface Props {
  open: boolean;
  onClose: () => void;
  status: BotStatusMessage | null;
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="status-panel__row">
      <span className="status-panel__label">{label}</span>
      <span className="status-panel__value">{value}</span>
    </div>
  );
}

function HealthBar({ value, max, colorClass }: { value: number; max: number; colorClass?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="status-panel__bar-wrap" aria-label={`${value} / ${max}`}>
      <div className={`status-panel__bar-fill ${colorClass ?? ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StatusPanel({ open, onClose, status }: Props) {
  return (
    <>
      {open && (
        <div
          className="status-panel__overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`status-panel ${open ? "status-panel--open" : ""}`}
        aria-label="ボットステータス"
        role="complementary"
      >
        <div className="status-panel__header">
          <span className="status-panel__title">Bot Status</span>
          <button
            type="button"
            className="status-panel__close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="status-panel__body">
          {status ? (
            <>
              <StatusRow label="ユーザー名" value={status.username} />
              <StatusRow label="ゲームモード" value={status.gameMode} />
              <StatusRow label="Ping" value={`${status.ping} ms`} />

              <div className="status-panel__section-title">体力 / 食料</div>
              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">❤️ 体力</span>
                <span className="status-panel__value">{status.health.toFixed(1)} / 20</span>
              </div>
              <HealthBar value={status.health} max={20} />

              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">🍖 食料</span>
                <span className="status-panel__value">{status.food} / 20</span>
              </div>
              <HealthBar value={status.food} max={20} />

              <StatusRow label="🌟 満腹度" value={status.foodSaturation.toFixed(1)} />
              <HealthBar value={status.foodSaturation} max={20} colorClass="status-panel__bar-fill--sat" />

              <div className="status-panel__section-title">経験値</div>
              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">⭐ レベル</span>
                <span className="status-panel__value">{status.experienceLevel}</span>
              </div>
              <HealthBar value={status.experienceProgress ?? 0} max={1} colorClass="status-panel__bar-fill--xp" />
              <StatusRow label="💠 ポイント" value={status.experiencePoints} />
            </>
          ) : (
            <div className="status-panel__empty">接続待機中…</div>
          )}
        </div>
      </aside>
    </>
  );
}
