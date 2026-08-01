"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Home,
  KeyRound,
  ListChecks,
  User,
} from "lucide-react";
import { loadAccountsData } from "@/lib/cloud-storage";
import type { InstagramAccount } from "@/lib/types";
import { getSelectedAccountId, setSelectedAccountId } from "@/lib/account-preference";

const primaryNav = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/posts", label: "投稿", icon: ListChecks },
  { href: "/dashboard", label: "分析", icon: BarChart3 },
  { href: "/reports", label: "レポート", icon: FileText },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/accounts", label: "プロフィール", icon: User },
  { href: "/token-management", label: "Instagram連携", icon: KeyRound },
];

const pageNames: Record<string, string> = {
  accounts: "プロフィール",
  analysis: "分析",
  calendar: "カレンダー",
  dashboard: "分析",
  posts: "投稿",
  reports: "レポート",
  "token-management": "Instagram連携",
};

export function AppNavigation() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const currentName = pathname === "/" ? "ホーム" : pageNames[firstSegment] ?? "便利な機能";
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccount] = useState("all");

  useEffect(() => {
    setSelectedAccount(getSelectedAccountId());
    loadAccountsData().then(setAccounts);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="mr-auto flex items-center gap-3 text-base font-semibold text-ink" aria-label="Instagram投稿分析AI ホーム">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm text-white">IA</span>
            <span className="hidden sm:inline">Instagram投稿分析AI</span>
          </Link>

          {accounts.length > 1 ? (
            <label className="flex min-w-0 items-center gap-2 text-xs text-stone-500">
              <span className="hidden lg:inline">表示中</span>
              <select
                aria-label="表示するInstagramアカウント"
                className="h-10 max-w-44 py-1"
                value={selectedAccountId}
                onChange={(event) => {
                  setSelectedAccountId(event.target.value);
                  setSelectedAccount(event.target.value);
                  window.location.reload();
                }}
              >
                <option value="all">すべて</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
          ) : null}

          <nav aria-label="メインメニュー" className="order-3 hidden w-full gap-1 overflow-x-auto md:order-2 md:flex md:w-auto">
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

        </div>
      </header>
      <nav aria-label="現在位置" className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-stone-500">
          <Link href="/" className="hover:text-ink">ホーム</Link>
          {pathname !== "/" ? <><span className="mx-2">/</span><span className="font-medium text-stone-700">{currentName}</span></> : null}
        </div>
      </nav>
      <nav aria-label="スマートフォン用メニュー" className="mobile-bottom-nav md:hidden">
        {primaryNav.slice(0, 4).concat(primaryNav[5]).map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "mobile-nav-active" : ""}>
              <Icon size={19} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
