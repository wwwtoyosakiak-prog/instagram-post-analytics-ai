"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Database, FileUp, ListChecks, Sparkles, TrendingUp, Users } from "lucide-react";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { getServerStorageStatus, loadAccountsData, loadAnalysesData, loadPostsData, loadTasksData } from "@/lib/cloud-storage";
import { AiAnalysisRecord, ImprovementTask, InstagramAccount, InstagramPost } from "@/lib/types";
import { average, formatPercent, getMetrics, postCategoryLabels, taskStatusLabels } from "@/lib/metrics";

export default function Home() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [latestAnalysisByPostId, setLatestAnalysisByPostId] = useState<Record<string, AiAnalysisRecord>>({});
  const [serverStorageEnabled, setServerStorageEnabled] = useState(false);

  useEffect(() => {
    Promise.all([loadAccountsData(), loadPostsData(), loadTasksData(), getServerStorageStatus()]).then(([loadedAccounts, loadedPosts, loadedTasks, status]) => {
      setAccounts(loadedAccounts);
      setPosts(loadedPosts);
      setTasks(loadedTasks);
      setServerStorageEnabled(status.serverStorageEnabled);
      Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]] as const)).then((analyses) => {
        setLatestAnalysisByPostId(Object.fromEntries(analyses.filter(([, analysis]) => Boolean(analysis))));
      });
    });
  }, []);

  const summary = useMemo(() => {
    const today = new Date();
    const todayKey = toDateKey(today);
    const currentMonth = todayKey.slice(0, 7);
    const topPost = [...posts].sort((a, b) => getMetrics(b).engagementRate - getMetrics(a).engagementRate)[0];
    const latest = [...posts].sort((a, b) => new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime())[0];
    const monthlyPosts = posts.filter((post) => post.date.startsWith(currentMonth));
    const openTasks = tasks.filter((task) => task.status !== "done");
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < todayKey);
    const dueSoonTasks = openTasks
      .filter((task) => task.dueDate)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4);
    const highScorePosts = posts
      .map((post) => ({ post, analysis: latestAnalysisByPostId[post.id] }))
      .filter((item): item is { post: InstagramPost; analysis: AiAnalysisRecord } => Boolean(item.analysis))
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .slice(0, 3);
    const nextPostToCheck = posts
      .filter((post) => !latestAnalysisByPostId[post.id])
      .sort((a, b) => new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime())[0]
      ?? [...posts].sort((a, b) => getMetrics(a).saveRate - getMetrics(b).saveRate)[0];
    return {
      totalViews: posts.reduce((sum, post) => sum + post.views, 0),
      averageEngagementRate: average(posts.map((post) => getMetrics(post).engagementRate)),
      monthlyPostCount: monthlyPosts.length,
      monthlyAverageSaveRate: average(monthlyPosts.map((post) => getMetrics(post).saveRate)),
      screenshotCount: posts.filter((post) => Boolean(post.screenshot)).length,
      openTasks,
      overdueTasks,
      dueSoonTasks,
      highScorePosts,
      nextPostToCheck,
      topPost,
      latest
    };
  }, [posts, tasks, latestAnalysisByPostId]);

  return (
    <div>
      <PageHeader
        title="今日のInstagram運用を確認"
        description="未完了タスク、期限切れ、今月の投稿状況、AIスコアの高い投稿をまとめて確認できます。"
        action={<ButtonLink href="/tasks">タスクを見る</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <QuickStat label="未完了タスク" value={`${summary.openTasks.length}件`} tone="moss" />
        <QuickStat label="期限切れタスク" value={`${summary.overdueTasks.length}件`} tone="clay" />
        <QuickStat label="今月の投稿数" value={`${summary.monthlyPostCount}件`} tone="plum" />
        <QuickStat label="今月の平均保存率" value={formatPercent(summary.monthlyAverageSaveRate)} tone="sky" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-clay" />
          <h2 className="flex items-center gap-2 font-semibold"><TrendingUp size={18} className="text-clay" />今日見るべきこと</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ButtonLink href="/tasks">未完了タスク</ButtonLink>
            <ButtonLink href="/calendar">カレンダー</ButtonLink>
            <ButtonLink href="/dashboard">成果を見る</ButtonLink>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-stone-700">
            <WorkItem
              icon={<AlertTriangle size={17} />}
              title="期限切れタスク"
              body={summary.overdueTasks.length ? `${summary.overdueTasks.length}件あります。優先して確認してください。` : "期限切れタスクはありません。"}
              href="/tasks"
              urgent={summary.overdueTasks.length > 0}
            />
            <WorkItem
              icon={<ClipboardList size={17} />}
              title="次に確認すべき投稿"
              body={summary.nextPostToCheck ? `${summary.nextPostToCheck.date} / ${postCategoryLabels[summary.nextPostToCheck.category ?? "other"]} / ${summary.nextPostToCheck.caption}` : "まだ投稿がありません。"}
              href={summary.nextPostToCheck ? `/posts/detail?id=${summary.nextPostToCheck.id}` : "/posts/new"}
            />
          </div>
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-moss" />運用ステータス</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <StatusRow label="アカウント登録" value={accounts.length ? `${accounts.length}件登録済み` : "未登録"} active={accounts.length > 0} />
            <StatusRow label="投稿データ" value={posts.length ? `${posts.length}件登録済み` : "未登録"} active={posts.length > 0} />
            <StatusRow label="画像スクショ" value={`${summary.screenshotCount}/${posts.length}件`} active={summary.screenshotCount > 0} />
            <StatusRow label="改善タスク" value={`${summary.openTasks.length}件が未完了`} active={summary.openTasks.length > 0} />
            <StatusRow label="保存先" value={serverStorageEnabled ? "サーバー保存" : "ブラウザ保存"} active={serverStorageEnabled} />
            <StatusRow label="AI接続" value="設定ページで確認" active />
          </div>
          <div className="mt-5 rounded-md border border-stone-200/80 bg-fog/80 p-3">
            <p className="text-sm font-semibold">データ保全</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">ブラウザ保存のため、定期的なバックアップがおすすめです。</p>
            <div className="mt-3">
              <ButtonLink href="/settings">バックアップ管理</ButtonLink>
            </div>
          </div>
        </Panel>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="flex items-center gap-2 font-semibold"><CalendarClock size={18} className="text-clay" />期限が近いタスク</h2>
          <div className="mt-4 grid gap-2">
            {summary.dueSoonTasks.map((task) => (
              <Link key={task.id} href="/tasks" className="rounded-md border border-stone-200 bg-white/80 p-3 text-sm hover:border-moss">
                <span className="font-semibold text-ink">{task.title}</span>
                <span className="mt-1 block text-xs text-stone-600">期限: {task.dueDate} / {taskStatusLabels[task.status]}</span>
              </Link>
            ))}
            {!summary.dueSoonTasks.length ? <p className="rounded-md bg-fog p-4 text-sm text-stone-600">期限付きの未完了タスクはありません。</p> : null}
          </div>
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-amber-700" />最近スコアが高かった投稿</h2>
          <div className="mt-4 grid gap-2">
            {summary.highScorePosts.map(({ post, analysis }) => (
              <Link key={post.id} href={`/posts/detail?id=${post.id}`} className="rounded-md border border-stone-200 bg-white/80 p-3 text-sm hover:border-moss">
                <span className="font-semibold text-ink">{analysis.score}点 / {post.date}</span>
                <span className="mt-1 block truncate text-xs text-stone-600">{post.caption}</span>
              </Link>
            ))}
            {!summary.highScorePosts.length ? <p className="rounded-md bg-fog p-4 text-sm text-stone-600">AI分析済みの投稿がありません。</p> : null}
          </div>
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 font-semibold"><ListChecks size={18} className="text-moss" />今月の運用メモ</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <StatusRow label="今月の投稿" value={`${summary.monthlyPostCount}件`} active={summary.monthlyPostCount > 0} />
            <StatusRow label="平均保存率" value={formatPercent(summary.monthlyAverageSaveRate)} active={summary.monthlyAverageSaveRate > 0} />
            <StatusRow label="全体平均ER" value={formatPercent(summary.averageEngagementRate)} active={posts.length > 0} />
            <StatusRow label="合計表示数" value={summary.totalViews.toLocaleString()} active={posts.length > 0} />
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Panel>
          <Users className="mb-4 text-moss" />
          <h2 className="font-semibold">アカウント管理</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">ブランドや店舗ごとにアカウントを登録し、投稿データを紐づけて集計できます。</p>
        </Panel>
        <Panel>
          <FileUp className="mb-4 text-clay" />
          <h2 className="font-semibold">手入力・CSV登録</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">投稿URL、キャプション、表示数、保存数などを1件ずつ登録できます。CSVでまとめて取り込みも可能です。</p>
        </Panel>
        <Panel>
          <Database className="mb-4 text-moss" />
          <h2 className="font-semibold">localStorage保存</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">初期版はブラウザ保存です。データアクセスを分けているため、SupabaseやPostgreSQLへ移行しやすい構成です。</p>
        </Panel>
        <Panel>
          <Sparkles className="mb-4 text-amber-700" />
          <h2 className="font-semibold">AI改善提案</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">OpenAI APIをサーバー側から呼び出し、投稿ごとの強み、弱み、改善案、ハッシュタグ、投稿スコアを出します。</p>
        </Panel>
      </div>
    </div>
  );
}

function WorkItem({ icon, title, body, href, urgent = false }: { icon: React.ReactNode; title: string; body: string; href: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`flex gap-3 rounded-md border p-3 transition hover:border-moss ${urgent ? "border-red-200 bg-red-50" : "border-stone-200/80 bg-fog/80"}`}>
      <span className={urgent ? "text-red-700" : "text-moss"}>{icon}</span>
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 line-clamp-2 block leading-6 text-stone-700">{body}</span>
      </span>
    </Link>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200/80 bg-white/70 px-3 py-2">
      <span className="font-medium text-stone-700">{label}</span>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${active ? "bg-skyglass text-ink" : "bg-stone-100 text-stone-500"}`}>{value}</span>
    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function QuickStat({ label, value, tone }: { label: string; value: string; tone: "moss" | "clay" | "plum" | "sky" }) {
  const toneClasses = {
    moss: "bg-moss",
    clay: "bg-clay",
    plum: "bg-plum",
    sky: "bg-skyglass"
  };
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/70 bg-white/78 p-4 shadow-panel backdrop-blur">
      <span className={`absolute left-0 top-0 h-full w-1 ${toneClasses[tone]}`} />
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
