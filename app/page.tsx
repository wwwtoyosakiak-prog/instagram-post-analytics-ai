"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, FileUp, ListChecks, Sparkles, TrendingUp, Users } from "lucide-react";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { loadAccounts, loadPosts } from "@/lib/storage";
import { InstagramAccount, InstagramPost } from "@/lib/types";
import { average, formatPercent, getMetrics } from "@/lib/metrics";

export default function Home() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);

  useEffect(() => {
    setAccounts(loadAccounts());
    setPosts(loadPosts());
  }, []);

  const summary = useMemo(() => {
    const topPost = [...posts].sort((a, b) => getMetrics(b).engagementRate - getMetrics(a).engagementRate)[0];
    const latest = [...posts].sort((a, b) => new Date(b.recordedDate ?? b.date).getTime() - new Date(a.recordedDate ?? a.date).getTime())[0];
    return {
      totalViews: posts.reduce((sum, post) => sum + post.views, 0),
      averageEngagementRate: average(posts.map((post) => getMetrics(post).engagementRate)),
      topPost,
      latest
    };
  }, [posts]);

  return (
    <div>
      <PageHeader
        title="Instagram投稿を手元のデータで振り返る"
        description="公式APIは使わず、手入力またはCSVで登録したアカウント・投稿データを保存し、一覧・グラフ・AI改善提案・月次レポートで運用を見直せます。"
        action={<ButtonLink href="/posts/new">投稿を登録</ButtonLink>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <QuickStat label="アカウント" value={`${accounts.length}件`} tone="moss" />
        <QuickStat label="投稿" value={`${posts.length}件`} tone="clay" />
        <QuickStat label="合計表示数" value={summary.totalViews.toLocaleString()} tone="plum" />
        <QuickStat label="平均ER" value={formatPercent(summary.averageEngagementRate)} tone="sky" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-clay" />
          <h2 className="flex items-center gap-2 font-semibold"><TrendingUp size={18} className="text-clay" />次に見るべきこと</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ButtonLink href="/accounts">アカウントを整える</ButtonLink>
            <ButtonLink href="/dashboard">グラフを見る</ButtonLink>
            <ButtonLink href="/reports">月次レポート</ButtonLink>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-stone-700 md:grid-cols-2">
            <div className="rounded-md border border-stone-200/80 bg-fog/80 p-3">
              <p className="font-semibold">最新データ登録</p>
              <p className="mt-1">{summary.latest ? `${summary.latest.recordedDate ?? summary.latest.date} / ${summary.latest.caption}` : "まだ投稿がありません。"}</p>
            </div>
            <div className="rounded-md border border-stone-200/80 bg-skyglass/60 p-3">
              <p className="font-semibold">反応が良い投稿</p>
              <p className="mt-1">{summary.topPost ? `${formatPercent(getMetrics(summary.topPost).engagementRate)} / ${summary.topPost.caption}` : "まだ投稿がありません。"}</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <h2 className="font-semibold">データ保全</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">ブラウザ保存のため、定期的なバックアップがおすすめです。設定ページからJSONで保存・復元できます。</p>
          <div className="mt-4">
            <ButtonLink href="/settings">バックアップ管理</ButtonLink>
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
