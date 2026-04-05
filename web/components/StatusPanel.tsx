"use client";

import type { BotStatusMessage, Position } from "@/types/bot";

interface Props {
  open: boolean;
  onClose: () => void;
  status: BotStatusMessage | null;
  position: Position | null;
}

function StatusRow({ label, icon, value }: { label: string; icon: string; value: string | number }) {
  return (
    <div className="status-panel__row">
      <span className="status-panel__label">
        <span className="material-symbols-outlined status-panel__row-icon">{icon}</span>
        {label}
      </span>
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

export default function StatusPanel({ open, onClose, status, position }: Props) {
  const fmt = (n: number) => n.toFixed(1);

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
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="status-panel__body">
          {status ? (
            <>
              <div className="status-panel__section-title">座標</div>
              {position ? (
                <div className="status-panel__coords">
                  <span className="material-symbols-outlined status-panel__coords-icon">location_on</span>
                  <div className="status-panel__coords-grid">
                    <span className="status-panel__coords-label">X</span>
                    <span className="status-panel__coords-val">{fmt(position.x)}</span>
                    <span className="status-panel__coords-label">Y</span>
                    <span className="status-panel__coords-val">{fmt(position.y)}</span>
                    <span className="status-panel__coords-label">Z</span>
                    <span className="status-panel__coords-val">{fmt(position.z)}</span>
                  </div>
                </div>
              ) : (
                <div className="status-panel__empty-inline">—</div>
              )}

              <StatusRow label="ユーザー名" icon="person" value={status.username} />
              <StatusRow label="ゲームモード" icon="sports_esports" value={status.gameMode} />
              <StatusRow label="Ping" icon="network_check" value={`${status.ping} ms`} />

              <div className="status-panel__section-title">体力 / 食料</div>
              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">
                  <span className="material-symbols-outlined status-panel__row-icon">favorite</span>
                  体力
                </span>
                <span className="status-panel__value">{status.health.toFixed(1)} / 20</span>
              </div>
              <HealthBar value={status.health} max={20} />

              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">
                  <span className="material-symbols-outlined status-panel__row-icon">restaurant</span>
                  食料
                </span>
                <span className="status-panel__value">{status.food} / 20</span>
              </div>
              <HealthBar value={status.food} max={20} />

              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">
                  <span className="material-symbols-outlined status-panel__row-icon">water_drop</span>
                  満腹度
                </span>
                <span className="status-panel__value">{status.foodSaturation.toFixed(1)}</span>
              </div>
              <HealthBar value={status.foodSaturation} max={20} colorClass="status-panel__bar-fill--sat" />

              <div className="status-panel__section-title">経験値</div>
              <div className="status-panel__row status-panel__row--bar">
                <span className="status-panel__label">
                  <span className="material-symbols-outlined status-panel__row-icon">auto_awesome</span>
                  レベル
                </span>
                <span className="status-panel__value">{status.experienceLevel}</span>
              </div>
              <HealthBar value={status.experienceProgress} max={1} colorClass="status-panel__bar-fill--xp" />
              <StatusRow label="ポイント" icon="diamond" value={status.experiencePoints} />
            </>
          ) : (
            <div className="status-panel__empty">接続待機中…</div>
          )}
        </div>
      </aside>
    </>
  );
}
