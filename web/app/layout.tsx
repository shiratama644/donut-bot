import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DonutSMP Bot",
  description: "DonutSMP Minecraft Bot コントローラー",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
