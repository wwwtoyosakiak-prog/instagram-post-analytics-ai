"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Database, ListChecks, RefreshCcw, Sparkles, TrendingUp } from "lucide-react";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
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
    const topPost = [...posts].sort((a, b) => getMetrics(b).engagementRate - getMetrics(a).engagementRate)[0];
    const latest = [...posts].sort((a, b) => new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime())[0];
    const monthlyPosts = posts.filter((post) => post.date.startsWith(currentMonth));
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
      highScorePosts,
      nextPostToCheck,
      topPost,
      latest
    };
  }, [posts, latestAnalysisByPostId]);

  return (
    <div>
      <PageHeader
        title="今日のInstagram運用を確認"
        description="API同期した投稿の動きと、今見るべき数値をまとめて確認できます。"
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <QuickStat label="今月の投稿数" value={`${summary.monthlyPostCount}件`} tone="plum" />
        <QuickStat label="今月の平均保存率" value={formatPercent(summary.monthlyAverageSaveRate)} tone="sky" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-clay" />
          <h2 className="flex items-center gap-2 font-semibold"><TrendingUp size={18} className="text-clay" />今日見るべきこと</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ButtonLink href="/calendar">カレンダー</ButtonLink>
            <ButtonLink href="/dashboard">成果を見る</ButtonLink>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-stone-700">
            <WorkItem
              icon={<ClipboardList size={17} />}
              title="次に確認すべき投稿"
              body={summary.nextPostToCheck ? `${summary.nextPostToCheck.date} / ${summary.nextPostToCheck.caption}` : "まだ投稿がありません。"}
              href={summary.nextPostToCheck ? `/posts/detail?id=${summary.nextPostToCheck.id}` : "/dashboard"}
            />
          </div>
        </Panel>
        <Panel>
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-moss" />運用ステータス</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <StatusRow label="投稿データ" value={posts.length ? `${posts.length}件同期済み` : "未同期"} active={posts.length > 0} />
            <StatusRow label="画像スクショ" value={`${summary.screenshotCount}/${posts.length}件`} active={summary.screenshotCount > 0} />
            <StatusRow label="保存先" value={serverStorageEnabled ? "サーバー保存" : "ブラウザ保存"} active={serverStorageEnabled} />
            <StatusRow label="AI接続" value="分析・提案に利用可能" active />
          </div>
          <div className="mt-5 rounded-md border border-stone-200/80 bg-fog/80 p-3">
            <p className="text-sm font-semibold">同期の基本動線</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">普段はダッシュボードからInstagramデータを同期し、トークン管理ページで期限切れだけ監視すれば運用できます。</p>
            <div className="mt-3">
              <ButtonLink href="/token-management">トークン管理を見る</ButtonLink>
            </div>
          </div>
        </Panel>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
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
      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <RefreshCcw className="mb-4 text-clay" />
          <h2 className="font-semibold">Instagram API同期</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">投稿、表示数、保存数、インサイト履歴はAPI同期を基本に扱います。手入力を前提にしない運用に寄せています。</p>
        </Panel>
        <Panel>
          <Database className="mb-4 text-moss" />
          <h2 className="font-semibold">Supabase保存</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">同期した投稿履歴、インサイト履歴、トークン更新履歴をまとめて保存します。継続運用の土台として使います。</p>
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
