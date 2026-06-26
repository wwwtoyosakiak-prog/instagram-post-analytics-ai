"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
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

  const monthlyPosts = useMemo(() => {
    return posts
      .filter((post) => post.date.startsWith(month) || (post.recordedDate ?? post.date).startsWith(month));
  }, [posts, month]);

  const postedThisMonth = useMemo(() => monthlyPosts.filter((post) => post.date.startsWith(month)), [monthlyPosts, month]);
  const recordedThisMonth = useMemo(() => monthlyPosts.filter((post) => (post.recordedDate ?? post.date).startsWith(month)), [monthlyPosts, month]);

  const days = useMemo(() => buildCalendarDays(month), [month]);

  const postsByPostedDate = useMemo(() => groupPostsByDate(postedThisMonth, "date"), [postedThisMonth]);
  const postsByRecordedDate = useMemo(() => groupPostsByDate(recordedThisMonth, "recordedDate"), [recordedThisMonth]);

  return (
    <div>
      <PageHeader
        title="投稿カレンダー"
        description="投稿日と分析登録日を月ごとに確認できます。"
        action={
          <Link href="/posts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-moss">
            投稿を登録
          </Link>
        }
      />

      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label>表示月</label>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div className="rounded-md border border-stone-200 bg-fog p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">見方</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-ink px-2 py-1 text-white">投稿日</span>
              <span className="rounded-full bg-clay px-2 py-1 text-white">分析登録日</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Stat label="今月の投稿数" value={`${postedThisMonth.length}件`} />
        <Stat label="分析登録数" value={`${recordedThisMonth.length}件`} />
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
              const recorded = postsByRecordedDate[day.date] ?? [];
              const separatelyRecorded = recorded.filter((post) => post.recordedDate !== post.date);
              const isCurrentMonth = day.date.startsWith(month);
              return (
                <div key={day.date} className={`min-h-32 border-b border-r border-stone-200 p-2 ${isCurrentMonth ? "bg-white" : "bg-stone-50 text-stone-400"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">{day.day}</span>
                    {posted.length || separatelyRecorded.length ? <span className="text-[11px] text-stone-500">{posted.length + separatelyRecorded.length}件</span> : null}
                  </div>
                  <div className="space-y-1">
                    {posted.map((post) => (
                      <CalendarItem
                        key={`posted-${post.id}`}
                        post={post}
                        accountName={post.accountId ? accountNameById[post.accountId] : undefined}
                        tone="posted"
                        sameDayRecorded={(post.recordedDate ?? post.date) === post.date}
                      />
                    ))}
                    {separatelyRecorded.map((post) => (
                      <CalendarItem key={`recorded-${post.id}`} post={post} accountName={post.accountId ? accountNameById[post.accountId] : undefined} tone="recorded" />
                    ))}
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

function groupPostsByDate(posts: InstagramPost[], key: "date" | "recordedDate") {
  return posts.reduce<Record<string, InstagramPost[]>>((grouped, post) => {
    const date = key === "recordedDate" ? post.recordedDate ?? post.date : post.date;
    grouped[date] = [...(grouped[date] ?? []), post];
    return grouped;
  }, {});
}

function CalendarItem({ post, accountName, tone, sameDayRecorded = false }: { post: InstagramPost; accountName?: string; tone: "posted" | "recorded"; sameDayRecorded?: boolean }) {
  const label = sameDayRecorded ? "投稿日・分析登録日" : tone === "posted" ? "投稿日" : "分析登録日";
  const toneClass = tone === "posted" ? "border-ink/20 bg-ink text-white" : "border-clay/20 bg-clay text-white";
  return (
    <Link href={`/posts/detail?id=${post.id}`} className={`block rounded-md border px-2 py-1 text-xs shadow-sm transition hover:opacity-90 ${toneClass}`}>
      <span className="block font-semibold">{label}</span>
      <span className="mt-0.5 block truncate opacity-90">{postTypeLabels[post.type]}{accountName ? ` / ${accountName}` : ""}</span>
    </Link>
  );
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
