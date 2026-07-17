"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, ClipboardList, FileText, KeyRound, ListChecks } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { getServerStorageStatus, loadAnalysesData, loadPostsData } from "@/lib/cloud-storage";
import { AiAnalysisRecord, InstagramPost } from "@/lib/types";
import { average, formatPercent, getMetrics } from "@/lib/metrics";

export default function Home() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [latestAnalysisByPostId, setLatestAnalysisByPostId] = useState<Record<string, AiAnalysisRecord>>({});
  const [serverStorageEnabled, setServerStorageEnabled] = useState(false);

  useEffect(() => {
    Promise.all([loadPostsData(), getServerStorageStatus()]).then(([loadedPosts, status]) => {
      setPosts(loadedPosts);
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
    const latest = [...posts].sort((a, b) => new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime())[0];
    const monthlyPosts = posts.filter((post) => post.date.startsWith(currentMonth));
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
      nextPostToCheck,
      latest
    };
  }, [posts, latestAnalysisByPostId]);

  return (
    <div>
      <PageHeader
        title="今日の運用確認"
        description="必要な入口だけを上にまとめています。まずは投稿、ダッシュボード、レポート、カレンダー、設定から選べます。"
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Stat label="今月の投稿数" value={`${summary.monthlyPostCount}件`} />
        <Stat label="全体平均ER" value={formatPercent(summary.averageEngagementRate)} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="text-lg font-semibold text-ink">よく使うページ</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <CategoryLink
              href="/posts"
              icon={<ListChecks size={18} />}
              title="投稿を確認する"
              description="投稿一覧、投稿詳細、次に見るべき投稿へ進みます。"
            />
            <CategoryLink
              href="/dashboard"
              icon={<BarChart3 size={18} />}
              title="ダッシュボードを見る"
              description="投稿全体の数字を確認します。"
            />
            <CategoryLink
              href="/reports"
              icon={<FileText size={18} />}
              title="レポートを見る"
              description="月ごとのまとまりを確認します。"
            />
            <CategoryLink
              href="/calendar"
              icon={<CalendarDays size={18} />}
              title="カレンダーを見る"
              description="投稿予定と日付の流れを確認します。"
            />
            <CategoryLink
              href="/settings"
              icon={<KeyRound size={18} />}
              title="設定を整える"
              description="アカウントや連携状態を確認します。"
            />
          </div>
          <div className="mt-5">
            <WorkItem
              icon={<ClipboardList size={16} />}
              title="次に確認する投稿"
              body={summary.nextPostToCheck ? `${summary.nextPostToCheck.date}の投稿を確認` : "まだ投稿がありません。"}
              href={summary.nextPostToCheck ? `/posts/detail?id=${summary.nextPostToCheck.id}` : "/posts"}
            />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-ink">いまの状態</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <StatusRow label="投稿データ" value={posts.length ? `${posts.length}件同期済み` : "未同期"} active={posts.length > 0} />
            <StatusRow label="画像" value={`${summary.screenshotCount}/${posts.length}件`} active={summary.screenshotCount > 0} />
            <StatusRow label="保存先" value={serverStorageEnabled ? "サーバー" : "ブラウザ"} active={serverStorageEnabled} />
            <StatusRow label="最新投稿" value={summary.latest ? summary.latest.date : "未登録"} active={Boolean(summary.latest)} />
          </div>
          <div className="mt-5 rounded-md border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-ink">迷ったら</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">投稿を確認して、必要ならダッシュボードかレポートを見るだけで十分です。</p>
          </div>
        </Panel>
      </div>
      <Panel>
        <h2 className="text-lg font-semibold text-ink">今月の要点</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <StatusRow label="平均保存率" value={formatPercent(summary.monthlyAverageSaveRate)} active={summary.monthlyAverageSaveRate > 0} />
          <StatusRow label="合計表示数" value={summary.totalViews.toLocaleString()} active={posts.length > 0} />
        </div>
      </Panel>
    </div>
  );
}

function CategoryLink({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg border border-stone-200 bg-white p-4 transition hover:bg-stone-50">
      <div className="flex items-center gap-2 text-ink">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
    </Link>
  );
}

function WorkItem({ icon, title, body, href, urgent = false }: { icon: React.ReactNode; title: string; body: string; href: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`flex gap-3 rounded-md border p-3 transition hover:bg-stone-50 ${urgent ? "border-red-200 bg-red-50" : "border-stone-200 bg-white"}`}>
      <span className={urgent ? "text-red-700" : "text-stone-500"}>{icon}</span>
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 line-clamp-2 block leading-6 text-stone-700">{body}</span>
      </span>
    </Link>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2">
      <span className="font-medium text-stone-700">{label}</span>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${active ? "bg-stone-100 text-ink" : "bg-stone-50 text-stone-500"}`}>{value}</span>
    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
