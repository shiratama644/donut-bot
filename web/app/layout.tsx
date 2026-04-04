import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DonutSMP Bot",
  description: "DonutSMP Minecraft Bot コントローラー",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
