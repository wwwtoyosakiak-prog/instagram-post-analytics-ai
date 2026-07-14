"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadPostsData } from "@/lib/cloud-storage";
import { InstagramAccount, InstagramPost } from "@/lib/types";
import { postTypeLabels } from "@/lib/metrics";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export default function CalendarPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData()]).then(([loadedPosts, loadedAccounts]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      const latestPost = [...loadedPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latestPost) setMonth(latestPost.date.slice(0, 7));
    });
  }, []);

  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);

  const monthlyPosts = useMemo(() => posts.filter((post) => post.date.startsWith(month)), [posts, month]);

  const postingDaysThisMonth = useMemo(() => new Set(monthlyPosts.map((post) => post.date)).size, [monthlyPosts]);
  const latestPostThisMonth = useMemo(() => [...monthlyPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null, [monthlyPosts]);
  const reelPostsThisMonth = useMemo(() => monthlyPosts.filter((post) => post.type === "reel").length, [monthlyPosts]);

  const days = useMemo(() => buildCalendarDays(month), [month]);

  const postsByPostedDate = useMemo(() => groupPostsByDate(monthlyPosts), [monthlyPosts]);

  return (
    <div>
      <PageHeader
        title="投稿カレンダー"
        description="投稿日ベースで、今月の投稿予定と実績を一覧で確認できます。"
        action={
          <Link href="/posts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-moss">
            投稿を登録
          </Link>
        }
      />

      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label>表示月</label>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              <ChevronLeft size={16} aria-hidden />
              前月
            </button>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              次月
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-stone-200 bg-fog p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">見方</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-ink px-2 py-1 text-white">投稿日</span>
              <span className="rounded-full bg-stone-200 px-2 py-1 text-stone-700">本文の先頭を表示</span>
            </div>
          </div>
      </Panel>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat label="今月の投稿数" value={`${monthlyPosts.length}件`} />
        <Stat label="投稿がある日" value={`${postingDaysThisMonth}日`} />
        <Stat label="最終投稿日" value={latestPostThisMonth ? latestPostThisMonth.date : "未登録"} note={reelPostsThisMonth ? `リール ${reelPostsThisMonth}件` : undefined} />
      </div>

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={20} className="text-moss" aria-hidden />
          <h2 className="font-semibold">{formatMonthLabel(month)}</h2>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-md border border-stone-200 bg-white">
          {weekdays.map((day) => (
            <div key={day} className="border-b border-stone-200 bg-fog px-2 py-2 text-center text-xs font-semibold text-stone-600">{day}</div>
          ))}
          {days.map((day) => {
            const posted = postsByPostedDate[day.date] ?? [];
            const isCurrentMonth = day.date.startsWith(month);
            const isToday = day.date === formatDateKey(new Date());
            return (
              <div key={day.date} className={`min-h-36 border-b border-r border-stone-200 p-2 ${isCurrentMonth ? "bg-white" : "bg-stone-50 text-stone-400"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "rounded-full bg-ink px-2 py-0.5 text-white" : ""}`}>{day.day}</span>
                  {posted.length ? <span className="text-[11px] text-stone-500">{posted.length}件</span> : null}
                </div>
                <div className="space-y-1">
                  {posted.slice(0, 3).map((post) => (
                    <CalendarItem
                      key={`posted-${post.id}`}
                      post={post}
                      accountName={post.accountId ? accountNameById[post.accountId] : undefined}
                    />
                  ))}
                  {posted.length > 3 ? <p className="px-1 text-[11px] font-medium text-stone-500">ほか {posted.length - 3}件</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstDate = new Date(year, monthIndex - 1, 1);
  const startDate = new Date(firstDate);
  startDate.setDate(firstDate.getDate() - firstDate.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      date: formatDateKey(date),
      day: date.getDate()
    };
  });
}

function groupPostsByDate(posts: InstagramPost[]) {
  return posts.reduce<Record<string, InstagramPost[]>>((grouped, post) => {
    grouped[post.date] = [...(grouped[post.date] ?? []), post];
    return grouped;
  }, {});
}

function CalendarItem({ post, accountName }: { post: InstagramPost; accountName?: string }) {
  const preview = getPostPreviewText(post.caption);
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="block rounded-md border border-ink/20 bg-ink px-2 py-1 text-xs text-white shadow-sm transition hover:opacity-90">
      <span className="block font-semibold">{postTypeLabels[post.type]}{accountName ? ` / ${accountName}` : ""}</span>
      <span className="mt-0.5 block line-clamp-2 opacity-90">{preview}</span>
    </Link>
  );
}

function getPostPreviewText(caption: string) {
  const firstLine = caption.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || "本文なし";
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split("-");
  return `${year}年${Number(monthIndex)}月`;
}

function shiftMonth(month: string, diff: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
