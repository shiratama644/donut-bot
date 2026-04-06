# DonutSMP Bot — 既知の問題一覧（2026-04-06 再調査）

このドキュメントは、現在の実装を再確認して更新した最新版です。  
（旧 issue のうち、解決済みのものは ✅ を付与）

> **凡例**: ✅ = 解決済み、🔴 = 高優先度、🟠 = 中高優先度、🟡 = 中優先度、🔵 = 低優先度

---

## 🔴 セキュリティ

### 1. CORS / オリジン検証なし
- **場所**: `src/websocketServer.ts`（`wss.on("connection")`）
- **内容**: 接続元オリジンを検証しておらず、任意オリジンから接続可能。
- **対処**: `request.headers.origin` の allowlist 検証を追加。

### 2. WebSocket 入力の厳密スキーマ検証なし
- **場所**: `src/websocketServer.ts`（`JSON.parse` 後）
- **内容**: `type` 文字列確認のみで、各メッセージ payload の実行時検証が不十分。
- **対処**: `zod` 等で受信 payload を検証。

### 3. チャット入力に文字数制限・レート制限なし
- **場所**: `src/websocketServer.ts`（`msg.type === "chat"`）
- **内容**: `trim()` のみで受け付けるため、スパム/DoS 耐性が弱い。
- **対処**: 最大文字数 + 接続単位レートリミットを追加。

### 4. フロントエンド受信メッセージの型検証が弱い
- **場所**: `web/hooks/useBotWebSocket.ts`
- **内容**: 受信時は `type` の存在チェック中心で、payload 型整合性は十分でない。
- **対処**: 判別共用体に対応した実行時バリデーションを追加。

### 5. `iframe sandbox` が強すぎる権限構成
- **場所**: `web/components/BotViewPanel.tsx`
- **内容**: `allow-scripts allow-same-origin` の組み合わせは sandbox 防御を弱める。
- **対処**: 要件再確認のうえ、必要最小権限へ縮小。

### 6. HTTPS 配信時の WebSocket フォールバックが `ws://`
- **場所**: `web/app/page.tsx`
- **内容**: `window.location.protocol` を見ず `ws://...:3000` 固定。
- **対処**: `https:` なら `wss://` を使う。

---

## 🟠 コード品質

### 7. `ws.onerror` が実質無処理
- **場所**: `web/hooks/useBotWebSocket.ts`
- **内容**: `close` 任せで、原因把握に必要な情報が残りにくい。
- **対処**: エラー内容をログ出力し、必要なら監視用イベントを送る。

### 8. モジュールスコープの `nextEntryId`
- **場所**: `web/components/ChatPanel.tsx`
- **内容**: コンポーネント外状態のため、再マウントや複数タブで扱いが不安定。
- **対処**: `useRef` 等でコンポーネント内管理へ移行。

### ✅ 9. `e.isComposing` の TypeScript エラー
> **解決済み** — `e.nativeEvent.isComposing` に修正済み（`web/components/ChatPanel.tsx`）。

---

## 🟡 バグ・実行時問題

### 10. 座標 NaN チェックが X のみ
- **場所**: `src/bot.ts`, `src/coordinates.ts`
- **内容**: `isNaN(pos.x)` のみ確認しており、Y/Z の NaN を弾けない。
- **対処**: X/Y/Z 全軸を検証。

### 11. WS フォールバック URL のポートが固定
- **場所**: `web/app/page.tsx`
- **内容**: `:3000` 固定のため、`WEB_PORT` 変更時に不整合が起きる。
- **対処**: `NEXT_PUBLIC_WS_URL` を本番必須化、または環境変数で統一。

### 12. Viewer フォールバック URL のポートが固定
- **場所**: `web/app/page.tsx`
- **内容**: `:3002` 固定で `BOT_VIEWER_PORT` 変更に追従しない。
- **対処**: `NEXT_PUBLIC_BOT_VIEWER_URL` を本番必須化、またはポート設定を統一。

### 13. アンマウント後 `onclose` の state 更新リスク
- **場所**: `web/hooks/useBotWebSocket.ts`
- **内容**: `onclose` 冒頭で `setConnected(false)` を実行しており、アンマウント競合リスクが残る。
- **対処**: `unmountedRef` チェック後に state 更新する。

### 14. 送信成功/失敗フィードバック不足
- **場所**: `web/components/ChatPanel.tsx`
- **内容**: 送信直後に入力を消去し、失敗時の UI 通知がない。
- **対処**: ACK ベース or 失敗トーストを導入。

### 15. localStorage エラーの種別判定なし
- **場所**: `web/hooks/useMessageHistory.ts`, `web/hooks/useTheme.ts`
- **内容**: 例外を一括処理しており、復旧戦略が粗い。
- **対処**: quota / parse などの分類対応。

### 16. Viewer 切替が依然として破壊的（close→再起動）
- **場所**: `src/viewer.ts`
- **内容**: Bot 切替時に既存 viewer を `close()` して再起動している。
- **対処**: `attachBot(bot)` / `detachBot()` 型へ移行し、サーバープロセスは維持。

### 17. status 間隔のサーバー真値と UI 表示の同期保証不足
- **場所**: `src/status.ts`, `web/app/page.tsx`, `web/hooks/useBotWebSocket.ts`
- **内容**: サーバー値は保持されるが、再接続時に UI との同期が曖昧。
- **対処**: 接続時に現在の間隔値を同期する仕組みを追加。

---

## 🔵 未実装・不完全な機能

### 18. タブ補完候補 UI なし
- **場所**: `src/websocketServer.ts`, `web/components/ChatPanel.tsx`
- **内容**: バックエンド応答はあるが、候補表示 UI は未実装。

### 19. `actionbar` の実データ配信なし
- **場所**: `src/chat.ts`, `web/types/bot.ts`
- **内容**: 型/UI はあるが、バックエンドは `actionbar` を broadcast していない。

### 20. チャット検索/フィルタ機能なし
- **場所**: `web/components/ChatPanel.tsx`

---

## 📋 エラーハンドリング不足

### 21. 認証失敗系エラーの分類と再試行戦略が不十分
- **場所**: `src/bot.ts`
- **内容**: `bot.on("error")` はログ中心で、失敗種別別の制御が弱い。

### 22. `connectTimeout` 未設定
- **場所**: `src/bot.ts`（`mineflayer.createBot`）
- **内容**: 接続待ちが長期化する可能性。

### 23. グレースフルシャットダウン不足
- **場所**: `src/index.ts`
- **内容**: `SIGTERM`/`SIGINT` ハンドリングがなく、安全な終了手順が未整備。

### 24. `EADDRINUSE` など listen エラーの専用ハンドリングなし
- **場所**: `src/websocketServer.ts`
- **内容**: `server.listen` 失敗時の利用者向けメッセージが弱い。

---

## 📚 ドキュメント

### ✅ 25. README 不在
> **解決済み** — `README.md` は整備済み。

### ✅ 26. 環境変数説明不足
> **解決済み** — README の環境変数表で説明済み。

### 27. WebSocket プロトコル表が実装と不一致
- **場所**: `README.md`（WebSocket プロトコル）
- **内容**:
  - `status` / `sent` / `actionbar` の記載不足
  - `setStatusInterval` 記載不足
  - `log` payload 記載が実装（`{ level, line }`）と不一致

### 28. トラブルシューティング未整備
- **場所**: `README.md`

---

## ⚙️ 設定・デプロイ

### 29. `.env.example` の VERSION 注意書き不足
- **場所**: `.env.example`
- **内容**: サーバーバージョンに合わせる注意を明記すると親切。

### 30. 本番向け設定分離不足
- **場所**: 全体
- **内容**: `NODE_ENV` ベースの切替やセキュリティヘッダ方針が未整理。

### 31. 起動時 env バリデーション不足
- **場所**: `src/config.ts`

---

## 🧪 テスト

### ✅ 32. 「ユニットテストが存在しない」
> **解決済み（部分的）** — `src/accounts.test.ts` / `src/authState.test.ts` が存在。  
> ただし主要機能（WebSocket ハンドラ、bot ライフサイクル、UI 連携）の網羅性は不足。

### 33. 統合テスト不足
- **内容**: フロント/バック間の契約テストが不足。

---

## ♿ アクセシビリティ

### 34. チャットログの ARIA 不足
- **場所**: `web/components/ChatPanel.tsx`
- **内容**: `role="log"` / `aria-live` 未設定。

---

## ⚡ パフォーマンス

### 35. 定期座標 broadcast の変化検知なし
- **場所**: `src/coordinates.ts`

### 36. メッセージ描画の仮想化なし
- **場所**: `web/components/ChatPanel.tsx`

---

## 🔧 インフラ・運用

### 37. `/health` エンドポイントなし
- **場所**: `src/websocketServer.ts`

### 38. WebSocket レートリミットなし
- **場所**: `src/websocketServer.ts`

### 39. `dist/` クリーン戦略なし
- **場所**: `package.json`

---

## 優先度サマリー

| 状態 | 件数 |
|------|------|
| ✅ 解決済み | 5（#9, #25, #26, #32, 旧README関連） |
| 未解決 | 34 |
| **合計** | **39** |

最優先は **#1〜#6（セキュリティ）** と **#16（viewer 切替戦略）** です。
