import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bot, CalendarDays, FileText, Home, KeyRound, ListChecks, Sparkles, Target, User } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram投稿分析AI",
  description: "Instagram Graph APIで同期した投稿を分析する運用改善ツール"
};

const nav = [
  { href: "/", label: "トップ", icon: Home },
  { href: "/accounts", label: "プロフィール", icon: User },
  { href: "/posts", label: "一覧", icon: ListChecks },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/goals", label: "目標", icon: Target },
  { href: "/dashboard", label: "ダッシュボード", icon: BarChart3 },
  { href: "/token-management", label: "トークン管理", icon: KeyRound },
  { href: "/reports", label: "月次レポート", icon: FileText },
  { href: "/performance-report", label: "AIレポート", icon: Sparkles },
  { href: "/ai-chat", label: "AIチャット", icon: Bot }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b border-white/60 bg-oat/82 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-normal text-ink">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-sm text-white shadow-soft">IA</span>
                <span>Instagram投稿分析AI</span>
              </Link>
              <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-white/70 bg-white/72 px-3 text-sm font-semibold text-stone-700 shadow-panel transition hover:border-moss hover:bg-white hover:text-ink"
                    >
                      <Icon size={16} aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
