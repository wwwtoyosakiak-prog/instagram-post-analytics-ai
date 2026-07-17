import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Home, KeyRound, ListChecks } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram投稿分析AI",
  description: "Instagram Graph APIで同期した投稿を分析する運用改善ツール"
};

const primaryNav = [
  { href: "/", label: "トップ", icon: Home },
  { href: "/posts", label: "投稿", icon: ListChecks },
  { href: "/dashboard", label: "ダッシュボード", icon: BarChart3 },
  { href: "/reports", label: "レポート", icon: FileText },
  { href: "/settings", label: "設定", icon: KeyRound }
];

const navLinkClass =
  "inline-flex h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-ink";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen bg-base">
          <header className="sticky top-0 z-30 border-b border-stone-200 bg-base/95 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-ink">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-sm text-white">IA</span>
                  <span>Instagram投稿分析AI</span>
                </Link>
                <nav className="flex flex-wrap items-center justify-end gap-2">
                  {primaryNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`${navLinkClass} shrink-0`}
                      >
                        <Icon size={16} aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
