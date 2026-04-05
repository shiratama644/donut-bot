"use client";

/**
 * Microsoft デバイスコード認証の表示コンポーネント。
 * verificationUri は Microsoft の公式ドメインのみ許可する。
 */

interface Props {
  userCode: string;
  verificationUri: string;
  /** カード形式（ログイン画面向け）か、オーバーレイ形式（メイン画面向け）か */
  variant?: "card" | "overlay";
}

/** verificationUri が信頼できる Microsoft ドメインか検証する */
function isTrustedMicrosoftUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    return (
      url.protocol === "https:" &&
      (url.hostname === "microsoft.com" ||
        url.hostname.endsWith(".microsoft.com") ||
        url.hostname === "microsoftonline.com" ||
        url.hostname.endsWith(".microsoftonline.com"))
    );
  } catch {
    return false;
  }
}

export default function MsaCodeDisplay({ userCode, verificationUri, variant = "card" }: Props) {
  const trusted = isTrustedMicrosoftUrl(verificationUri);
  const prefix = variant === "overlay" ? "msa-code-card" : "msa-code-box";

  return (
    <div className={prefix}>
      {variant === "overlay" && (
        <div className={`${prefix}__title`}>
          <span className="material-symbols-outlined">key</span>
          Microsoft 認証が必要です
        </div>
      )}
      {variant === "card" && (
        <p className={`${prefix}__label`}>Microsoftでの認証が必要です</p>
      )}
      <p className={`${prefix}__step`}>
        {trusted ? (
          <a
            className={`${prefix}__link`}
            href={verificationUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            {verificationUri}
          </a>
        ) : (
          <span>{verificationUri}</span>
        )}{" "}
        にアクセスして、以下のコードを入力してください：
      </p>
      <div className={`${prefix}__code`}>{userCode}</div>
      <p className={`${prefix}__note`}>認証が完了すると自動的に接続されます。</p>
    </div>
  );
}
