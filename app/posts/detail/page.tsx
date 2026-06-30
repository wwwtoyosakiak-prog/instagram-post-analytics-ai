"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { deletePostData, loadAccountsData, loadAnalysesData, loadInsightData, loadPostsData, saveAnalysisData } from "@/lib/cloud-storage";
import { AiAnalysis, AiAnalysisRecord, InstagramAccount, InstagramInsightSnapshot, InstagramPost } from "@/lib/types";
import { formatPercent, getMetrics, postTypeLabels } from "@/lib/metrics";
import { matchPostToMedia, type ApiMedia } from "@/lib/post-merge";
import { createSampleAnalysis } from "@/lib/sample-analysis";

export default function PostDetailPage() {
  return (
    <Suspense fallback={<PageHeader title="投稿詳細" description="投稿データを読み込んでいます。" />}>
      <PostDetailContent />
    </Suspense>
  );
}

function PostDetailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [post, setPost] = useState<InstagramPost | null>(null);
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AiAnalysisRecord[]>([]);
  const [latestInsight, setLatestInsight] = useState<InstagramInsightSnapshot | null>(null);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [matchedMedia, setMatchedMedia] = useState<ApiMedia | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");

  useEffect(() => {
    setInsightLoading(true);
    Promise.all([
      loadPostsData(),
      loadAccountsData(),
      loadAnalysesData(id),
      loadInsightData(id),
      fetch("/api/instagram/media?limit=200").then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]).then(([posts, accounts, analyses, insightData, mediaJson]) => {
      const foundPost = posts.find((item) => item.id === id) ?? null;
      setPost(foundPost);
      setAccount(accounts[0] ?? null);
      setAnalysisHistory(analyses);
      setAnalysis(analyses[0] ?? null);
      setLatestInsight(insightData.insight);
      setInsightHistory(insightData.insights);
      const mediaList = (mediaJson as { data?: ApiMedia[] }).data ?? [];
      setMatchedMedia(foundPost ? matchPostToMedia(foundPost, mediaList) ?? null : null);
      setInsightLoading(false);
    });
  }, [id]);

  if (!post) {
    return <PageHeader title="投稿が見つかりません" description="一覧から投稿を選び直してください。" />;
  }

  const metrics = getMetrics(post);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post, account })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "分析に失敗しました。");
      setAnalysis(data.analysis);
      setSavingAnalysis(true);
      const saved = await saveAnalysisData(post.id, data.analysis);
      if (saved) {
        setAnalysisHistory((current) => [saved, ...current]);
        setAnalysis(saved);
        setAnalysisMessage("AI分析結果を保存しました。");
      } else {
        setAnalysisMessage("AI分析結果を表示しました。サーバー保存は未設定です。");
      }
    } catch {
      setError("GitHub Pages公開版ではOpenAI API Routeは動きません。サンプル分析を使うか、Vercelで公開してください。");
    } finally {
      setLoading(false);
      setSavingAnalysis(false);
    }
  };

  const useSampleAnalysis = async () => {
    const sample = createSampleAnalysis(post);
    setAnalysis(sample);
    setSavingAnalysis(true);
    const saved = await saveAnalysisData(post.id, sample);
    if (saved) {
      setAnalysisHistory((current) => [saved, ...current]);
      setAnalysis(saved);
      setAnalysisMessage("サンプル分析結果を保存しました。");
    } else {
      setAnalysisMessage("サンプル分析を表示しました。サーバー保存は未設定です。");
    }
    setSavingAnalysis(false);
  };

  const removePost = async () => {
    if (!window.confirm("この投稿データを削除しますか？")) return;
    await deletePostData(post.id);
    router.push("/posts");
  };

  return (
    <div>
      <PageHeader title="投稿詳細・AI分析" description="投稿内容、画像、数値をもとに改善案を確認します。" />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="エンゲージメント数" value={metrics.engagement.toLocaleString()} />
        <Stat label="エンゲージメント率" value={formatPercent(metrics.engagementRate)} />
        <Stat label="保存率" value={formatPercent(metrics.saveRate)} />
        <Stat label="コメント率" value={formatPercent(metrics.commentRate)} />
      </div>
      <LatestInsightSection
        insight={latestInsight}
        loading={insightLoading}
        isReel={post.type === "reel"}
        apiInsights={matchedMedia?.latest_insights ?? null}
      />
      <InsightTrend snapshots={insightHistory} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Panel>
          {getPostPreview(post) ? <img src={getPostPreview(post)} alt="投稿画像・動画サムネイル" className="mb-4 max-h-[520px] w-full rounded-md object-contain" /> : <div className="mb-4 rounded-md bg-stone-100 p-8 text-center text-sm text-stone-500">投稿画像未取得</div>}
          <dl className="space-y-3 text-sm">
            <div><dt className="font-semibold">投稿日</dt><dd>{toJSTDate(post.date)}</dd></div>
            <div><dt className="font-semibold">データ登録日</dt><dd>{toJSTDate(post.recordedDate ?? post.date)}</dd></div>
            <div><dt className="font-semibold">投稿タイプ</dt><dd>{postTypeLabels[post.type]}</dd></div>
            <div><dt className="font-semibold">投稿画像・動画の枚数</dt><dd>{post.mediaCount ?? 1}</dd></div>
            <div><dt className="font-semibold">投稿URL</dt><dd className="break-all">{post.url || "未登録"}</dd></div>
            <div><dt className="font-semibold">投稿コメント</dt><dd className="leading-6">{post.caption}</dd></div>
            <div><dt className="font-semibold">ハッシュタグ</dt><dd className="leading-6">{post.hashtags || "なし"}</dd></div>
            <div><dt className="font-semibold">メモ</dt><dd className="leading-6">{post.memo || "なし"}</dd></div>
            <div><dt className="font-semibold">登録日時</dt><dd>{formatDateTime(post.createdAt)}</dd></div>
            <div><dt className="font-semibold">編集日時</dt><dd>{formatDateTime(post.updatedAt ?? post.createdAt)}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/posts/edit?id=${post.id}`} className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-ink hover:border-moss">
              編集
            </Link>
            <Button variant="secondary" onClick={removePost}>削除</Button>
          </div>
        </Panel>
        <Panel>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={analyze} disabled={loading || savingAnalysis}>{loading ? "分析中..." : savingAnalysis ? "保存中..." : "OpenAIで分析・保存"}</Button>
            <Button variant="secondary" onClick={useSampleAnalysis} disabled={savingAnalysis}>サンプル分析を保存</Button>
          </div>
          {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {analysisMessage ? <p className="mb-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{analysisMessage}</p> : null}
          {analysis ? (
            <AnalysisView analysis={analysis} />
          ) : <p className="text-sm text-stone-600">分析を実行すると、投稿スコア・改善案・投稿案・ハッシュタグが保存されます。</p>}
          <AnalysisComparison analyses={analysisHistory} onSelect={(item) => setAnalysis(item)} />
        </Panel>
      </div>
    </div>
  );
}

function InsightTrend({ snapshots }: { snapshots: InstagramInsightSnapshot[] }) {
  if (!snapshots.length) return null;
  const rows = [...snapshots].reverse().map((snapshot) => ({
    date: new Date(snapshot.capturedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    閲覧数: snapshot.views,
    リーチ: snapshot.reach,
    保存数: snapshot.saved,
    シェア数: snapshot.shares
  }));

  return (
    <section className="mt-7">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">インサイト推移</h2>
        <p className="mt-1 text-sm text-stone-600">同期ごとの数値変化を確認できます。現在 {snapshots.length} 回分です。</p>
      </div>
      <div className="h-72 w-full">
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
            <Line type="monotone" dataKey="シェア数" stroke="#8b6f47" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function formatWatchTime(ms: number | null): string {
  if (ms == null) return "–";
  const s = ms / 1000;
  if (s >= 60) return `${Math.floor(s / 60)}分${Math.round(s % 60)}秒`;
  return `${s.toFixed(1)}秒`;
}

function LatestInsightSection({
  insight,
  loading,
  isReel,
  apiInsights
}: {
  insight: InstagramInsightSnapshot | null;
  loading: boolean;
  isReel: boolean;
  apiInsights: ApiMedia["latest_insights"] | null;
}) {
  const v = (n: number | null | undefined) => (n != null ? n.toLocaleString() : "–");
  return (
    <section className="mt-7 border-y border-stone-200 py-6">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">最新のInstagramインサイト</h2>
          <p className="mt-1 text-sm text-stone-600">Instagram Graph APIから同期した最新値です。</p>
        </div>
        {insight ? <p className="text-xs font-semibold text-stone-500">取得日時: {formatDateTime(insight.capturedAt)}</p> : null}
      </div>
      {loading ? (
        <p className="text-sm text-stone-600">インサイトを読み込んでいます。</p>
      ) : insight ? (
        <div className="space-y-3">
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
          {isReel && insight.reelAvgWatchTime != null && (
            <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-pink-600">リール指標</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="平均視聴時間" value={formatWatchTime(insight.reelAvgWatchTime)} />
                <Stat label="総再生時間" value={formatWatchTime(insight.reelTotalViewTime)} />
                <Stat label="再生回数" value={v(apiInsights?.plays)} />
                <Stat label="リプレイ回数" value={v(insight.reelClipsReplaysCount)} />
              </div>
            </div>
          )}
          <div className="rounded-lg border border-stone-200 bg-white/80 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">追加のAPI指標</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="インプレッション" value={v(apiInsights?.impressions)} />
              <Stat label="再生回数" value={v(apiInsights?.plays)} />
              <Stat label="総再生時間" value={formatWatchTime(insight?.reelTotalViewTime ?? null)} />
              <Stat label="リプレイ回数" value={v(insight?.reelClipsReplaysCount)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">
          この投稿のインサイトはまだありません。Graph APIページで同期後、再度確認してください。
        </div>
      )}
    </section>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function toJSTDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function getPostPreview(post: InstagramPost) {
  return post.screenshot || post.thumbnailUrl || post.mediaUrl || "";
}

function AnalysisView({ analysis }: { analysis: AiAnalysis }) {
  const scoreDelta = "scoreDelta" in analysis ? analysis.scoreDelta : null;
  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-skyglass p-4">
        <p className="text-sm font-medium text-stone-600">投稿スコア</p>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <p className="text-4xl font-bold text-ink">{analysis.score}<span className="text-lg"> / 100</span></p>
          {typeof scoreDelta === "number" ? (
            <p className={`mb-1 rounded-md px-2 py-1 text-sm font-semibold ${scoreDelta >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              前回比 {scoreDelta >= 0 ? "+" : ""}{scoreDelta}
            </p>
          ) : null}
        </div>
      </div>
      {[
        ["投稿の第一印象", analysis.firstImpression],
        ["画像から伝わる内容", analysis.imageMessage],
        ["キャプションのわかりやすさ", analysis.captionClarity],
        ["数値から見た強み", analysis.strengths],
        ["数値から見た弱み", analysis.weaknesses],
        ["伸びた / 伸びなかった可能性", analysis.reason]
      ].map(([title, body]) => (
        <section key={title}>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-700">{body}</p>
        </section>
      ))}
      <List title="次回改善案" items={analysis.improvements} />
      <List title="おすすめ投稿案" items={analysis.nextIdeas} />
      <List title="おすすめハッシュタグ" items={analysis.hashtags} />
    </div>
  );
}

function AnalysisComparison({ analyses, onSelect }: { analyses: AiAnalysisRecord[]; onSelect: (analysis: AiAnalysisRecord) => void }) {
  if (!analyses.length) return null;
  const latest = analyses[0];
  const previous = analyses[1] ?? null;
  const chartData = [...analyses].reverse().map((item, index) => ({
    name: `${index + 1}回目`,
    score: item.score,
    date: formatDateTime(item.createdAt)
  }));

  return (
    <section className="mt-8 border-t border-stone-200 pt-5">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-semibold">AI分析比較</h2>
          <p className="mt-1 text-sm text-stone-600">同じ投稿を再分析した履歴とスコア推移を確認できます。</p>
        </div>
        <p className="text-sm font-semibold text-stone-600">{analyses.length}件の分析履歴</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CompareCard label="最新スコア" value={`${latest.score}/100`} />
        <CompareCard label="前回との差分" value={typeof latest.scoreDelta === "number" ? `${latest.scoreDelta >= 0 ? "+" : ""}${latest.scoreDelta}` : "初回"} tone={typeof latest.scoreDelta === "number" && latest.scoreDelta < 0 ? "down" : "up"} />
        <CompareCard label="最新分析日時" value={formatDateTime(latest.createdAt)} />
      </div>

      {analyses.length >= 2 ? (
        <div className="mt-5 rounded-md border border-stone-200 bg-white/80 p-4">
          <h3 className="font-semibold">スコア推移</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}点`, "投稿スコア"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} />
                <Line type="monotone" dataKey="score" stroke="#b4573f" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {previous ? <AnalysisDiff latest={latest} previous={previous} /> : null}

      <div className="mt-3 grid gap-2">
        {analyses.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-stone-200 bg-white/80 px-3 py-2 text-left text-sm hover:border-moss"
          >
            <span>
              <span className="font-semibold">{formatDateTime(item.createdAt)}</span>
              <span className="ml-2 text-stone-500">スコア {item.score}/100</span>
            </span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${typeof item.scoreDelta === "number" && item.scoreDelta < 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
              {typeof item.scoreDelta === "number" ? `前回比 ${item.scoreDelta >= 0 ? "+" : ""}${item.scoreDelta}` : "初回"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CompareCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "up" | "down" }) {
  const toneClass = tone === "up" ? "bg-emerald-50 text-emerald-800" : tone === "down" ? "bg-red-50 text-red-800" : "bg-fog text-ink";
  return (
    <div className="rounded-md border border-stone-200 bg-white/80 p-3">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-md px-2 py-1 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function AnalysisDiff({ latest, previous }: { latest: AiAnalysisRecord; previous: AiAnalysisRecord }) {
  return (
    <div className="mt-5 rounded-md border border-stone-200 bg-white/80 p-4">
      <h3 className="font-semibold">前回からの変化</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DiffList title="今回の改善案" items={latest.improvements} />
        <DiffList title="前回の改善案" items={previous.improvements} muted />
        <DiffList title="今回の投稿案" items={latest.nextIdeas} />
        <DiffList title="前回の投稿案" items={previous.nextIdeas} muted />
      </div>
    </div>
  );
}

function DiffList({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 grid gap-2">
        {items.slice(0, 4).map((item) => (
          <li key={item} className={`rounded-md px-3 py-2 text-sm ${muted ? "bg-stone-100 text-stone-600" : "bg-skyglass text-ink"}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => <li key={item} className="rounded-md bg-stone-100 px-3 py-2 text-sm">{item}</li>)}
      </ul>
    </section>
  );
}
