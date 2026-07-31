"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  FileText,
  Home,
  KeyRound,
  ListChecks,
  User,
} from "lucide-react";

const primaryNav = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "投稿", icon: ListChecks },
  { href: "/dashboard", label: "分析", icon: BarChart3 },
  { href: "/reports", label: "レポート", icon: FileText },
];

const menuGroups = [
  {
    title: "日々の運用",
    links: [
      { href: "/calendar", label: "カレンダー", icon: CalendarDays },
      { href: "/post-schedules", label: "投稿予定", icon: ListChecks },
      { href: "/accounts", label: "プロフィール", icon: User },
    ],
  },
  {
    title: "連携",
    links: [
      { href: "/token-management", label: "Instagram連携", icon: KeyRound },
    ],
  },
];

const pageNames: Record<string, string> = {
  accounts: "プロフィール",
  analysis: "分析",
  calendar: "カレンダー",
  dashboard: "分析",
  posts: "投稿",
  reports: "レポート",
  settings: "設定",
  "token-management": "Instagram連携",
};

export function AppNavigation() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const currentName = pathname === "/" ? "ホーム" : pageNames[firstSegment] ?? "便利な機能";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="mr-auto flex items-center gap-3 text-base font-semibold text-ink" aria-label="Instagram投稿分析AI ホーム">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm text-white">IA</span>
            <span className="hidden sm:inline">Instagram投稿分析AI</span>
          </Link>

          <nav aria-label="メインメニュー" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`nav-primary ${active ? "nav-primary-active" : ""}`}>
                  <Icon size={17} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <details className="group relative order-2 sm:order-3">
            <summary className="nav-more">
              すべての機能
              <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-3 shadow-xl">
              <p className="px-2 pb-2 text-xs text-stone-500">目的から選んでください</p>
              {menuGroups.map((group) => (
                <div key={group.title} className="border-t border-stone-100 py-2 first:border-0 first:pt-0">
                  <p className="px-2 py-1 text-xs font-semibold text-stone-500">{group.title}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {group.links.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-ink">
                          <Icon size={16} aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      </header>
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-stone-500">
          <Link href="/" className="hover:text-ink">ホーム</Link>
          {pathname !== "/" ? <><span className="mx-2">/</span><span className="font-medium text-stone-700">{currentName}</span></> : null}
        </div>
      </div>
    </>
  );
}
