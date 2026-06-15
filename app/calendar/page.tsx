"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadAccountsData, loadPostsData, loadTasksData } from "@/lib/cloud-storage";
import { ImprovementTask, InstagramAccount, InstagramPost } from "@/lib/types";
import { postCategoryLabels, postCategoryOptions, postTypeLabels, taskStatusLabels } from "@/lib/metrics";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export default function CalendarPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    Promise.all([loadPostsData(), loadAccountsData(), loadTasksData()]).then(([loadedPosts, loadedAccounts, loadedTasks]) => {
      setPosts(loadedPosts);
      setAccounts(loadedAccounts);
      setTasks(loadedTasks);
      const latestPost = [...loadedPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latestPost) setMonth(latestPost.date.slice(0, 7));
    });
  }, []);

  const accountNameById = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);
  const postById = useMemo(() => Object.fromEntries(posts.map((post) => [post.id, post])), [posts]);

  const monthlyPosts = useMemo(() => {
    return posts
      .filter((post) => accountId === "all" || post.accountId === accountId)
      .filter((post) => post.date.startsWith(month) || (post.recordedDate ?? post.date).startsWith(month));
  }, [posts, accountId, month]);

  const postedThisMonth = useMemo(() => monthlyPosts.filter((post) => post.date.startsWith(month)), [monthlyPosts, month]);
  const recordedThisMonth = useMemo(() => monthlyPosts.filter((post) => (post.recordedDate ?? post.date).startsWith(month)), [monthlyPosts, month]);
  const monthlyTasks = useMemo(() => {
    const visiblePostIds = new Set(posts.filter((post) => accountId === "all" || post.accountId === accountId).map((post) => post.id));
    return tasks
      .filter((task) => task.dueDate?.startsWith(month))
      .filter((task) => accountId === "all" || !task.postId || visiblePostIds.has(task.postId));
  }, [tasks, posts, accountId, month]);

  const openTasksThisMonth = useMemo(() => monthlyTasks.filter((task) => task.status !== "done"), [monthlyTasks]);

  const categorySummary = useMemo(() => {
    return postCategoryOptions
      .map((category) => {
        const items = postedThisMonth.filter((post) => (post.category ?? "other") === category.value);
        return { name: category.label, count: items.length };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [postedThisMonth]);

  const days = useMemo(() => buildCalendarDays(month), [month]);

  const postsByPostedDate = useMemo(() => groupPostsByDate(postedThisMonth, "date"), [postedThisMonth]);
  const postsByRecordedDate = useMemo(() => groupPostsByDate(recordedThisMonth, "recordedDate"), [recordedThisMonth]);
  const tasksByDueDate = useMemo(() => groupTasksByDueDate(monthlyTasks), [monthlyTasks]);
  const strongestCategory = categorySummary[0];

  return (
    <div>
      <PageHeader
        title="投稿カレンダー"
        description="投稿日、分析登録日、改善タスクの期限を月ごとに確認できます。"
        action={
          <Link href="/posts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-moss">
            投稿を登録
          </Link>
        }
      />

      <Panel className="mb-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label>表示月</label>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div>
            <label>アカウント</label>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="all">すべて</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
          <div className="rounded-md border border-stone-200 bg-fog p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">見方</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-ink px-2 py-1 text-white">投稿日</span>
              <span className="rounded-full bg-clay px-2 py-1 text-white">分析登録日</span>
              <span className="rounded-full bg-plum px-2 py-1 text-white">タスク期限</span>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Stat label="今月の投稿数" value={`${postedThisMonth.length}件`} />
        <Stat label="分析登録数" value={`${recordedThisMonth.length}件`} />
        <Stat label="期限付きタスク" value={`${monthlyTasks.length}件`} />
        <Stat label="未完了タスク" value={`${openTasksThisMonth.length}件`} />
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Stat label="使用カテゴリ数" value={`${categorySummary.length}種類`} />
        <Stat label="最多カテゴリ" value={strongestCategory ? `${strongestCategory.name} ${strongestCategory.count}件` : "未登録"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
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
              const dueTasks = tasksByDueDate[day.date] ?? [];
              const separatelyRecorded = recorded.filter((post) => post.recordedDate !== post.date);
              const isCurrentMonth = day.date.startsWith(month);
              return (
                <div key={day.date} className={`min-h-32 border-b border-r border-stone-200 p-2 ${isCurrentMonth ? "bg-white" : "bg-stone-50 text-stone-400"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">{day.day}</span>
                    {posted.length || separatelyRecorded.length || dueTasks.length ? <span className="text-[11px] text-stone-500">{posted.length + separatelyRecorded.length + dueTasks.length}件</span> : null}
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
                    {dueTasks.map((task) => (
                      <TaskCalendarItem key={`task-${task.id}`} task={task} post={task.postId ? postById[task.postId] : undefined} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-semibold">カテゴリ別投稿数</h2>
          <p className="mt-2 text-sm text-stone-600">投稿日ベースで、今月どのテーマを何回投稿したかを集計しています。</p>
          <div className="mt-4 space-y-3">
            {categorySummary.map((item) => {
              const width = postedThisMonth.length ? Math.max(8, (item.count / postedThisMonth.length) * 100) : 0;
              return (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">{item.name}</span>
                    <span className="text-stone-600">{item.count}件</span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-200">
                    <div className="h-2 rounded-full bg-moss" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {!categorySummary.length ? <p className="rounded-md bg-fog p-4 text-sm text-stone-600">この月の投稿カテゴリはまだありません。</p> : null}
          </div>

          <div className="mt-6 border-t border-stone-200 pt-5">
            <h3 className="font-semibold">期限付きタスク</h3>
            <div className="mt-3 grid gap-2">
              {monthlyTasks.slice(0, 6).map((task) => (
                <Link key={task.id} href="/tasks" className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm hover:border-moss">
                  <span className="font-semibold">{task.dueDate} / {taskStatusLabels[task.status]}</span>
                  <span className="mt-1 block line-clamp-2 text-stone-600">{task.title}</span>
                </Link>
              ))}
              {!monthlyTasks.length ? <p className="rounded-md bg-fog p-4 text-sm text-stone-600">この月に期限付きタスクはありません。</p> : null}
            </div>
          </div>

          <div className="mt-6 border-t border-stone-200 pt-5">
            <h3 className="font-semibold">カテゴリ一覧</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {postCategoryOptions.map((category) => (
                <span key={category.value} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                  {category.label}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>
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

function groupTasksByDueDate(tasks: ImprovementTask[]) {
  return tasks.reduce<Record<string, ImprovementTask[]>>((grouped, task) => {
    if (!task.dueDate) return grouped;
    grouped[task.dueDate] = [...(grouped[task.dueDate] ?? []), task];
    return grouped;
  }, {});
}

function CalendarItem({ post, accountName, tone, sameDayRecorded = false }: { post: InstagramPost; accountName?: string; tone: "posted" | "recorded"; sameDayRecorded?: boolean }) {
  const category = postCategoryLabels[post.category ?? "other"];
  const label = sameDayRecorded ? "投稿日・分析登録日" : tone === "posted" ? "投稿日" : "分析登録日";
  const toneClass = tone === "posted" ? "border-ink/20 bg-ink text-white" : "border-clay/20 bg-clay text-white";
  return (
    <Link href={`/posts/detail?id=${post.id}`} className={`block rounded-md border px-2 py-1 text-xs shadow-sm transition hover:opacity-90 ${toneClass}`}>
      <span className="block font-semibold">{label}: {category}</span>
      <span className="mt-0.5 block truncate opacity-90">{postTypeLabels[post.type]} / {accountName ?? "未選択"}</span>
    </Link>
  );
}

function TaskCalendarItem({ task, post }: { task: ImprovementTask; post?: InstagramPost }) {
  const toneClass = task.status === "done" ? "border-emerald-200 bg-emerald-100 text-emerald-900" : "border-plum/20 bg-plum text-white";
  return (
    <Link href="/tasks" className={`block rounded-md border px-2 py-1 text-xs shadow-sm transition hover:opacity-90 ${toneClass}`}>
      <span className="block font-semibold">タスク期限: {taskStatusLabels[task.status]}</span>
      <span className="mt-0.5 block truncate opacity-90">{post ? `${postCategoryLabels[post.category ?? "other"]} / ` : ""}{task.title}</span>
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
