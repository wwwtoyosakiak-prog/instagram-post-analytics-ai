"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, FileText, KeyRound, ListChecks, User } from "lucide-react";
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
        title="今日、確認すること"
        description="上から順に確認すれば、Instagram運用の状態と次の行動が分かります。"
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="今月の投稿" value={`${summary.monthlyPostCount}件`} note="今月公開した投稿数" />
        <Stat label="平均反応率" value={formatPercent(summary.averageEngagementRate)} note="いいね・保存などの割合" />
        <Stat label="今月の保存率" value={formatPercent(summary.monthlyAverageSaveRate)} note="あとで見たいと思われた割合" />
        <Stat label="合計表示数" value={summary.totalViews.toLocaleString()} note="登録済み投稿の合計" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-700" />
            <h2 className="text-lg font-semibold text-ink">3ステップで確認</h2>
          </div>
          <p className="mt-1 text-sm text-stone-600">初めてでも、この順番で進めれば迷いません。</p>
          <div className="mt-4 grid gap-3">
            <StepLink
              step="1"
              href="/posts"
              icon={<ListChecks size={18} />}
              title="投稿を確認"
              description="最新の投稿データと、未分析の投稿を確認します。"
            />
            <StepLink
              step="2"
              href="/dashboard"
              icon={<BarChart3 size={18} />}
              title="結果を分析"
              description="表示数・保存率・反応率から、伸びた理由を確認します。"
            />
            <StepLink
              step="3"
              href="/reports"
              icon={<FileText size={18} />}
              title="次の方針を決める"
              description="月次レポートを見て、次の投稿方針を決めます。"
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
            <p className="mt-1 text-sm leading-6 text-stone-600">まず投稿を確認し、次に分析、最後にレポートを見れば十分です。</p>
          </div>
        </Panel>
      </div>
      <Panel>
        <h2 className="text-lg font-semibold text-ink">管理と連携</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CategoryLink href="/calendar" icon={<CalendarDays size={18} />} title="カレンダー" description="投稿日と予定を確認" />
          <CategoryLink href="/accounts" icon={<User size={18} />} title="プロフィール" description="アカウント情報を管理" />
          <CategoryLink href="/token-management" icon={<KeyRound size={18} />} title="Instagram連携" description="連携状態と期限を確認" />
        </div>
      </Panel>
    </div>
  );
}

function StepLink({ step, href, icon, title, description }: { step: string; href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400 hover:bg-stone-50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{step}</span>
      <span className="text-stone-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-stone-600">{description}</span>
      </span>
      <span className="text-stone-400 transition group-hover:translate-x-1" aria-hidden>→</span>
    </Link>
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
