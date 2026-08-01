import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram投稿分析AI",
  description: "Instagram Graph APIで同期した投稿を分析する運用改善ツール"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <a href="#main-content" className="skip-link">本文へ移動</a>
        <div className="min-h-screen bg-base">
          <AppNavigation />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
