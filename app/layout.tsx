import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, Columns3, Home, KeyRound, ListChecks, Sparkles, User } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram投稿分析AI",
  description: "Instagram Graph APIで同期した投稿を分析する運用改善ツール"
};

const primaryNav = [
  { href: "/", label: "トップ", icon: Home },
  { href: "/posts", label: "投稿", icon: ListChecks },
  { href: "/analysis", label: "分析", icon: BarChart3 },
  { href: "/settings", label: "設定", icon: KeyRound }
];

const secondaryNavGroups = [
  {
    label: "設定",
    items: [
      { href: "/accounts", label: "プロフィール", icon: User },
      { href: "/token-management", label: "トークン管理", icon: KeyRound }
    ]
  },
  {
    label: "投稿管理",
    items: [
      { href: "/calendar", label: "カレンダー", icon: CalendarDays }
    ]
  },
  {
    label: "AI・運用",
    items: [
      { href: "/performance-report", label: "AIレポート", icon: Sparkles },
      { href: "/content-pipeline", label: "制作パイプライン", icon: Columns3 }
    ]
  },
  {
    label: "分析",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: BarChart3 }
    ]
  }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen bg-base">
          <header className="sticky top-0 z-30 border-b border-stone-200 bg-base/95 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-ink">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-sm text-white">IA</span>
                  <span>Instagram投稿分析AI</span>
                </Link>
                <nav className="flex gap-2 overflow-x-auto pb-1">
                  {primaryNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-ink"
                      >
                        <Icon size={16} aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="mt-3 rounded-md border border-stone-200 bg-white px-4 py-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {secondaryNavGroups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{group.label}</p>
                      <div className="grid gap-2">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-stone-700 transition hover:bg-stone-50 hover:text-ink"
                            >
                              <Icon size={16} aria-hidden />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
