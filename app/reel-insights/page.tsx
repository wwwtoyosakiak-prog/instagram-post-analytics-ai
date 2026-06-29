"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { loadInsightData, loadPostsData } from "@/lib/cloud-storage";
import { InstagramInsightSnapshot, InstagramPost } from "@/lib/types";

export default function ReelInsightsPage() {
  return (
    <Suspense fallback={<PageHeader title="リール分析" description="データを読み込んでいます。" />}>
      <ReelInsightsContent />
    </Suspense>
  );
}

function formatWatchTime(ms: number | null | undefined): string {
  if (ms == null) return "–";
  const s = ms / 1000;
  if (s >= 60) return `${Math.floor(s / 60)}分${Math.round(s % 60)}秒`;
  return `${s.toFixed(1)}秒`;
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function getPostPreview(post: InstagramPost) {
  return post.thumbnailUrl || post.mediaUrl || post.screenshot || "";
}

function MetricsGrid({ insight }: { insight: InstagramInsightSnapshot }) {
  const v = (n: number | null | undefined) => (n != null ? n.toLocaleString() : "–");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="閲覧数" value={v(insight.views)} />
        <Stat label="リーチ" value={v(insight.reach)} />
        <Stat label="いいね数" value={v(insight.likes)} />
        <Stat label="保存数" value={v(insight.saved)} />
        <Stat label="コメント数" value={v(insight.comments)} />
        <Stat label="シェア数" value={v(insight.shares)} />
        <Stat label="総インタラクション" value={v(insight.totalInteractions)} />
        <Stat label="プロフィールアクセス" value={v(insight.profileVisits)} />
        <Stat label="フォロー数" value={v(insight.follows)} />
      </div>
      {insight.reelAvgWatchTime != null && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-600">リール指標</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="平均視聴時間" value={formatWatchTime(insight.reelAvgWatchTime)} />
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ snapshots }: { snapshots: InstagramInsightSnapshot[] }) {
  if (snapshots.length < 2) return null;
  const rows = [...snapshots].reverse().map((s) => ({
    date: new Date(s.capturedAt).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    閲覧数: s.views,
    リーチ: s.reach,
    保存数: s.saved,
  }));

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-ink">指標の推移</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={28} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="閲覧数" stroke="#53624a" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="リーチ" stroke="#b55d3e" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="保存数" stroke="#266b65" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ReelInsightsContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";

  const [post, setPost] = useState<InstagramPost | null>(null);
  const [latestInsight, setLatestInsight] = useState<InstagramInsightSnapshot | null>(null);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); setNotFound(true); return; }
    Promise.all([loadPostsData(), loadInsightData(id)]).then(([posts, insightData]) => {
      const found = posts.find((p) => p.id === id) ?? null;
      if (!found) setNotFound(true);
      setPost(found);
      setLatestInsight(insightData.insight);
      setInsightHistory(insightData.insights);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <PageHeader title="リール分析" description="データを読み込んでいます。" />;
  }

  if (notFound || !post) {
    return (
      <div>
        <PageHeader title="リール分析" description="投稿が見つかりません。" />
        <Link href="/posts" className="text-sm text-moss hover:underline">← 投稿一覧に戻る</Link>
      </div>
    );
  }

  const preview = getPostPreview(post);
  const permalink = post.url || "";

  return (
    <div>
      <PageHeader title="リール分析" description="リール投稿のインサイト詳細です。" />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/posts" className="text-moss hover:underline">← 投稿一覧</Link>
        <Link href={`/posts/detail?id=${post.id}`} className="text-moss hover:underline">詳細・AI分析ページ →</Link>
        {permalink && (
          <a href={permalink} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
            Instagram で開く ↗
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Panel>
          {preview ? (
            <img src={preview} alt="リールサムネイル" className="mb-4 w-full rounded-md object-cover" />
          ) : (
            <div className="mb-4 flex h-48 items-center justify-center rounded-md bg-stone-100 text-sm text-stone-500">
              サムネイル未取得
            </div>
          )}
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold">投稿日</dt><dd>{post.date}</dd></div>
            <div>
              <dt className="font-semibold">キャプション</dt>
              <dd className="mt-1 line-clamp-5 leading-6 text-stone-600">{post.caption || "–"}</dd>
            </div>
          </dl>
        </Panel>

        <div>
          {latestInsight ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">最新インサイト</h2>
                <span className="text-xs text-stone-500">取得日時: {formatDateTime(latestInsight.capturedAt)}</span>
              </div>
              <MetricsGrid insight={latestInsight} />
            </>
          ) : (
            <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-sm text-stone-600">
              インサイトがまだありません。Graph API ページで同期後、再度確認してください。
            </div>
          )}
          <TrendChart snapshots={insightHistory} />
        </div>
      </div>
    </div>
  );
}
