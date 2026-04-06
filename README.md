# DonutSMP Bot

Minecraft サーバー「DonutSMP」に接続し、ブラウザから操作・監視できる Bot コントローラーです。

## 概要

- **バックエンド**: [mineflayer](https://github.com/PrismarineJS/mineflayer) で Minecraft サーバーに接続し、WebSocket 経由で情報を中継する Node.js サーバー
- **フロントエンド**: チャット・ログ閲覧・座標表示を提供する Next.js/React の Web UI
- **構成**: pnpm ワークスペースを用いたモノレポ

---

## 必要環境

- [Node.js](https://nodejs.org/) v18 以上
- [pnpm](https://pnpm.io/) v9 以上
- Microsoft アカウント（`AUTH=microsoft` の場合）または Minecraft オフラインアカウント

---

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、各項目を設定します。

```bash
cp .env.example .env
```

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `HOST` | ✅ | 接続先 Minecraft サーバーのホスト名（例: `donutsmp.net`） |
| `PORT` | | Minecraft サーバーのポート番号（デフォルト: `25565`） |
| `BOT_USERNAME` | | Bot の Microsoft アカウントのメールアドレス（未設定時は Web UI で入力） |
| `BOT_PASSWORD` | | Bot の Microsoft アカウントのパスワード（後述「認証方法」を参照） |
| `AUTH` | ✅ | 認証方式: `microsoft` または `offline` |
| `VERSION` | | Minecraft のバージョン（例: `1.21.1`）。サーバーに合わせて設定 |
| `WEB_PORT` | | Bot WebSocket サーバーのポート番号（デフォルト: `3000`） |
| `BOT_VIEWER_PORT` | | Bot 視点 Viewer サーバーのポート番号（デフォルト: `3002`） |
| `BOT_VIEWER_PREFIX` | | Bot 視点 Viewer の URL プレフィックス（デフォルト: `/viewer`） |
| `BOT_VIEWER_VIEW_DISTANCE` | | Bot 視点 Viewer の描画距離（デフォルト: `6`） |
| `NEXT_PUBLIC_WS_URL` | | Web UI から接続する WebSocket の URL（例: `ws://localhost:3000`）。本番環境では必ず設定 |
| `NEXT_PUBLIC_BOT_VIEWER_URL` | | Web UI に埋め込む Bot 視点 Viewer の URL（例: `http://localhost:3002/viewer/`）。未設定時は `window.location.protocol` を使って自動解決 |

---

## 認証方法（`AUTH=microsoft` の場合）

### パスワード認証（推奨・自動ログイン）

`.env` または Web UI で `BOT_PASSWORD` 相当のパスワードを設定すると、毎回コードを入力せず自動でログインできます。

```env
BOT_USERNAME=your_email@example.com
BOT_PASSWORD=your_password
AUTH=microsoft
```

> **注意**: 2要素認証（2FA/MFA）が有効なアカウントでは使用できません。2FA が有効な場合はデバイスコード認証を使用してください。

**`BOT_USERNAME` を変えると？** → 認証トークンのキャッシュはユーザー名のハッシュをキーとして管理されるため、ユーザー名を変えると別のキャッシュが参照され、新しいユーザーで自動的にパスワード認証が走ります。

### デバイスコード認証（2FA 対応）

`BOT_PASSWORD` を設定しない場合、初回起動時にターミナルへ以下のメッセージが表示されます。

```
[msa] First time signing in. Please authenticate now:
To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code XXXXXXXX to authenticate.
```

ブラウザで URL を開き、コードを入力して認証してください。認証後はトークンがプロジェクト内の `.cache/` に保存されるため、以降の起動ではコード入力は不要です（トークン有効期限が切れるまで）。

---

## 起動方法

### 開発環境（Bot + Web UI を同時起動）

```bash
pnpm dev:all
```

### Bot のみ起動

```bash
pnpm dev
```

### Web UI のみ起動

```bash
pnpm web:dev
```

### 本番ビルド & 起動

```bash
# バックエンドをビルド
pnpm build

# フロントエンドをビルド
pnpm web:build

# バックエンドを起動
pnpm start

# フロントエンドを起動
pnpm web:start
```

---

## ディレクトリ構成

```
donut-bot/
├── src/                      # バックエンド（Bot + WebSocket サーバー）
│   ├── index.ts              # エントリーポイント
│   ├── bot.ts                # mineflayer Bot の生成・ライフサイクル管理
│   ├── config.ts             # 環境変数による設定管理
│   ├── logger.ts             # ログ出力・WebSocket ブロードキャスト
│   ├── chat.ts               # チャットメッセージのハンドリング
│   ├── coordinates.ts        # 座標の定期ブロードキャスト
│   ├── websocketServer.ts    # HTTP + WebSocket サーバー
│   └── broadcast.ts          # WebSocket ブロードキャストユーティリティ
├── web/                      # フロントエンド（Next.js）
│   ├── app/
│   │   ├── layout.tsx        # ルートレイアウト
│   │   ├── page.tsx          # ホームページ
│   │   └── globals.css       # グローバルスタイル（ライト/ダークテーマ）
│   ├── components/
│   │   ├── Header.tsx        # Bot ステータス・座標・テーマ切替
│   │   └── ChatPanel.tsx     # チャット表示・送信 UI
│   ├── hooks/
│   │   ├── useBotWebSocket.ts    # WebSocket 接続管理・自動再接続
│   │   ├── useMessageHistory.ts  # メッセージ履歴（localStorage）
│   │   └── useTheme.ts           # ライト/ダークテーマ管理
│   ├── lib/
│   │   └── sanitize.ts       # テキストサニタイズ（ANSI / Minecraft カラーコード）
│   └── types/
│       └── bot.ts            # WebSocket メッセージの型定義
├── docs/
│   └── issues.md             # 既知の問題一覧
├── .env.example              # 環境変数テンプレート
├── package.json              # ルートパッケージ（Bot 依存関係）
├── pnpm-workspace.yaml       # pnpm ワークスペース設定
└── tsconfig.json             # TypeScript 設定（バックエンド）
```

---

## WebSocket プロトコル

認証ライフサイクル（状態遷移・リトライ分類・副作用・バージョン方針）の正式仕様は
[docs/auth-lifecycle.md](docs/auth-lifecycle.md) を参照してください。

### サーバー → クライアント（Bot からの通知）

| `type` | ペイロード | 説明 |
|--------|-----------|------|
| `chat` | `{ text: string }` | チャットメッセージ |
| `log` | `{ text: string }` | システムログ |
| `pos` | `{ x: number, y: number, z: number }` | Bot の現在座標 |

### クライアント → サーバー（操作コマンド）

| `type` | ペイロード | 説明 |
|--------|-----------|------|
| `chat` | `{ text: string }` | チャットメッセージ送信 |
| `tabcomplete` | `{ text: string, requestId: number }` | タブ補完リクエスト |

---

## 既知の問題

詳細は [docs/issues.md](docs/issues.md) を参照してください。

主な問題:
- WebSocket サーバーにオリジン検証がなく、任意のオリジンから接続可能
- 入力バリデーション・レートリミットが未実装
- テストコードが存在しない

---

## ライセンス

このプロジェクトのライセンスは未定義です。利用・配布の際はリポジトリオーナーに確認してください。
