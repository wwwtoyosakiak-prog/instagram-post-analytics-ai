"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { deletePostData, loadAccountsData, loadAnalysesData, loadInsightData, loadPostsData, saveAnalysisData } from "@/lib/cloud-storage";
import { AiAnalysis, AiAnalysisRecord, InstagramAccount, InstagramInsightSnapshot, InstagramPost } from "@/lib/types";
import { formatPercent, getMetrics, postTypeLabels } from "@/lib/metrics";
import { matchPostToMedia, type ApiMedia } from "@/lib/post-merge";

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
      setError("GitHub Pages公開版ではOpenAI分析は動きません。利用する場合はVercelなどのAPIが動く環境で公開してください。");
    } finally {
      setLoading(false);
      setSavingAnalysis(false);
    }
  };

  const removePost = async () => {
    if (!window.confirm("この投稿データを削除しますか？")) return;
    await deletePostData(post.id);
    router.push("/posts");
  };

  return (
    <div>
      <PageHeader title="投稿詳細・AI分析" description="投稿内容、画像、数値をもとに改善案を確認します。" />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="エンゲージメント数" value={metrics.engagement.toLocaleString()} />
        <Stat label="反応率" value={formatPercent(metrics.engagementRate)} note="いいね等の反応 ÷ 表示数" />
        <Stat label="保存率" value={formatPercent(metrics.saveRate)} />
      </div>
      <LatestInsightSection
        insight={latestInsight}
        loading={insightLoading}
        isReel={post.type === "reel"}
        apiInsights={matchedMedia?.latest_insights ?? null}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <Panel>
          {getPostPreview(post) ? <img src={getPostPreview(post)} alt="投稿画像・動画サムネイル" className="mb-4 max-h-[520px] w-full rounded-md object-contain" /> : <div className="mb-4 rounded-md bg-stone-100 p-8 text-center text-sm text-stone-500">投稿画像未取得</div>}
          <dl className="space-y-3 text-sm">
            <div><dt className="font-semibold">投稿日</dt><dd>{toJSTDate(post.date)}</dd></div>
            <div><dt className="font-semibold">データ登録日</dt><dd>{toJSTDate(post.recordedDate ?? post.date)}</dd></div>
            <div><dt className="font-semibold">投稿タイプ</dt><dd>{postTypeLabels[post.type]}</dd></div>
            <div><dt className="font-semibold">投稿URL</dt><dd className="break-all">{post.url || "未登録"}</dd></div>
            <div><dt className="font-semibold">投稿コメント</dt><dd className="leading-6">{post.caption}</dd></div>
            <div><dt className="font-semibold">ハッシュタグ</dt><dd className="leading-6">{post.hashtags || "なし"}</dd></div>
            <div><dt className="font-semibold">メモ</dt><dd className="leading-6">{post.memo || "なし"}</dd></div>
          </dl>
          <details open className="mt-4 rounded-md border border-stone-200 bg-stone-50">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">詳細情報を開く</summary>
            <dl className="grid gap-3 border-t border-stone-200 px-4 py-4 text-sm">
              <div><dt className="font-semibold">投稿画像・動画の枚数</dt><dd>{post.mediaCount ?? 1}</dd></div>
              <div><dt className="font-semibold">登録日時</dt><dd>{formatDateTime(post.createdAt)}</dd></div>
              <div><dt className="font-semibold">編集日時</dt><dd>{formatDateTime(post.updatedAt ?? post.createdAt)}</dd></div>
            </dl>
          </details>
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
          </div>
          {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {analysisMessage ? <p className="mb-4 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{analysisMessage}</p> : null}
          {analysis ? (
            <AnalysisView analysis={analysis} />
          ) : <p className="text-sm text-stone-600">分析を実行すると、投稿スコア・改善案・投稿案・ハッシュタグが保存されます。</p>}
          {insightHistory.length > 0 ? (
            <details open className="mt-6 rounded-md border border-stone-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">インサイト推移を開く</summary>
              <div className="border-t border-stone-200 px-4 py-4">
                <InsightTrend snapshots={insightHistory} />
              </div>
            </details>
          ) : null}
          {analysisHistory.length > 0 ? (
            <details open className="mt-6 rounded-md border border-stone-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-stone-700">分析履歴を開く</summary>
              <div className="border-t border-stone-200 px-4 py-4">
                <AnalysisComparison analyses={analysisHistory} onSelect={(item) => setAnalysis(item)} />
              </div>
            </details>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function InsightTrend({ snapshots }: { snapshots: InstagramInsightSnapshot[] }) {
  const [range, setRange] = useState<"1d" | "7d" | "14d" | "30d">("7d");

  const rows = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    const latestAt = new Date(sorted[sorted.length - 1]?.capturedAt ?? Date.now()).getTime();
    const rangeDays = { "1d": 1, "7d": 7, "14d": 14, "30d": 30 }[range];
    const startAt = latestAt - rangeDays * 24 * 60 * 60 * 1000;

    return sorted
      .filter((snapshot) => new Date(snapshot.capturedAt).getTime() >= startAt)
      .map((snapshot) => ({
        date: new Date(snapshot.capturedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        capturedAt: snapshot.capturedAt,
        閲覧数: snapshot.views
      }));
  }, [range, snapshots]);

  if (!snapshots.length) return null;

  const latestViews = rows[rows.length - 1]?.閲覧数 ?? null;
  const firstViews = rows[0]?.閲覧数 ?? null;
  const viewsDelta = latestViews != null && firstViews != null ? latestViews - firstViews : null;

  return (
    <section className="mt-7">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="text-lg font-bold text-ink">インサイト推移</h2>
        <div className="flex flex-wrap gap-2">
          <RangeButton active={range === "1d"} onClick={() => setRange("1d")}>1日</RangeButton>
          <RangeButton active={range === "7d"} onClick={() => setRange("7d")}>1週間</RangeButton>
          <RangeButton active={range === "14d"} onClick={() => setRange("14d")}>2週間</RangeButton>
          <RangeButton active={range === "30d"} onClick={() => setRange("30d")}>1ヶ月</RangeButton>
        </div>
      </div>
      <p className="mb-4 text-sm text-stone-600">選んだ期間のビュー数の変化を確認できます。現在 {rows.length} 回分です。</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="期間の最初" value={firstViews != null ? firstViews.toLocaleString() : "–"} />
        <Stat label="最新ビュー数" value={latestViews != null ? latestViews.toLocaleString() : "–"} />
        <Stat label="増減" value={viewsDelta != null ? `${viewsDelta >= 0 ? "+" : ""}${viewsDelta.toLocaleString()}` : "–"} />
      </div>
      {rows.length > 0 ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="閲覧数" stroke="#53624a" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">
          この期間のビュー履歴はまだありません。
        </div>
      )}
    </section>
  );
}

function RangeButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}
    >
      {children}
    </button>
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
            <Stat label="総反応数" value={v(insight.totalInteractions)} />
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
  const score = analysis.scoreBreakdown;
  const detailed = analysis.improvementsDetailed ?? [];
  const hashtag = analysis.hashtagSuggestion;
  const postingTime = analysis.postingTimeSuggestion;
  const caption = analysis.captionSuggestion;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white/80">
        <div className="grid gap-5 p-5 lg:grid-cols-[180px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-lg bg-skyglass p-5 text-center">
            <p className="text-sm font-semibold text-stone-600">総合投稿スコア</p>
            <p className="mt-2 text-5xl font-bold text-ink">
              {analysis.score}
              <span className="text-lg text-stone-500"> / 100</span>
            </p>
            {typeof scoreDelta === "number" ? (
              <p className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ${scoreDelta >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                前回比 {scoreDelta >= 0 ? "+" : ""}{scoreDelta}
              </p>
            ) : null}
            {score ? <ConfidenceBadge value={score.confidence} /> : null}
          </div>

          {score ? (
            <div>
              <h2 className="font-semibold">スコア内訳</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ScoreBar label="内容の魅力" value={score.content} />
                <ScoreBar label="画像・動画" value={score.visual} />
                <ScoreBar label="キャプション" value={score.caption} />
                <ScoreBar label="実際の反応" value={score.engagement} />
                <ScoreBar label="発見されやすさ" value={score.discoverability} />
              </div>
              {score.summary ? (
                <p className="mt-4 rounded-md bg-fog px-4 py-3 text-sm leading-6 text-stone-700">{score.summary}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center">
              <p className="text-sm leading-6 text-stone-600">
                この分析は旧形式です。もう一度AI分析を実行すると、5項目のスコア内訳が表示されます。
              </p>
            </div>
          )}
        </div>
      </section>

      {detailed.length ? (
        <section>
          <div>
            <h2 className="font-semibold">優先度付き改善提案</h2>
            <p className="mt-1 text-sm text-stone-600">上から順に直すと、次回投稿へ反映しやすくなります。</p>
          </div>
          <div className="mt-4 grid gap-3">
            {detailed.map((item, index) => (
              <div key={`${item.category}-${index}`} className="rounded-lg border border-stone-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs font-semibold text-stone-500">{item.category}</span>
                </div>
                {item.issue ? <p className="mt-3 text-sm font-medium text-stone-700">{item.issue}</p> : null}
                <p className="mt-2 text-sm leading-6 text-ink">{item.suggestion}</p>
                {item.example ? (
                  <div className="mt-3 rounded-md bg-skyglass px-3 py-2 text-sm leading-6 text-stone-700">
                    <span className="font-semibold">具体例：</span>{item.example}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <List title="次回改善案" items={analysis.improvements} />
      )}

      {caption ? (
        <section className="rounded-lg border border-stone-200 bg-white/80 p-5">
          <div>
            <h2 className="font-semibold">キャプション改善AI</h2>
            <p className="mt-1 text-sm text-stone-600">目的に合わせて複数の完成稿を使い分けられます。</p>
          </div>

          {caption.strategy ? (
            <p className="mt-4 rounded-md bg-skyglass px-4 py-3 text-sm leading-6 text-stone-700">
              <span className="font-semibold">改善戦略：</span>{caption.strategy}
            </p>
          ) : null}

          {caption.hookOptions?.length ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">冒頭フック3案</p>
              <div className="mt-2 grid gap-2">
                {caption.hookOptions.map((item, index) => (
                  <CopyTextCard key={item} label={`案${index + 1}`} text={item} />
                ))}
              </div>
            </div>
          ) : caption.hook ? (
            <CopyTextCard label="おすすめ冒頭" text={caption.hook} />
          ) : null}

          <div className="mt-5 grid gap-4">
            <CaptionVariant title="通常版" text={caption.improvedCaption} />
            {caption.shortVersion ? <CaptionVariant title="短文版" text={caption.shortVersion} /> : null}
            {caption.reelVersion ? <CaptionVariant title="リール向け版" text={caption.reelVersion} /> : null}
            {caption.ctaStrongVersion ? <CaptionVariant title="CTA強化版" text={caption.ctaStrongVersion} /> : null}
          </div>

          {caption.ctaOptions?.length ? (
            <div className="mt-5">
              <p className="text-sm font-semibold">CTA候補</p>
              <div className="mt-2 grid gap-2">
                {caption.ctaOptions.map((item, index) => (
                  <CopyTextCard key={item} label={`CTA ${index + 1}`} text={item} />
                ))}
              </div>
            </div>
          ) : caption.callToAction ? (
            <CopyTextCard label="おすすめCTA" text={caption.callToAction} />
          ) : null}

          {caption.changes.length ? <TagList label="主な変更" items={caption.changes} /> : null}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {postingTime ? (
          <section className="rounded-lg border border-stone-200 bg-white/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">おすすめ投稿時間</h2>
                <p className="mt-1 text-sm text-stone-600">次回投稿の候補時間です。</p>
              </div>
              <ConfidenceBadge value={postingTime.confidence} />
            </div>
            <div className="mt-5 rounded-lg bg-skyglass p-4 text-center">
              <p className="text-lg font-bold text-ink">{postingTime.bestDay}</p>
              <p className="mt-1 text-3xl font-bold text-ink">{postingTime.bestTime}</p>
            </div>
            {postingTime.alternatives.length ? (
              <TagList label="代替候補" items={postingTime.alternatives} />
            ) : null}
            <p className="mt-4 text-sm leading-6 text-stone-700">{postingTime.reason}</p>
            <p className="mt-3 text-xs font-semibold text-stone-500">
              根拠：{postingEvidenceLabel(postingTime.evidence)}
            </p>
          </section>
        ) : null}

        {hashtag ? (
          <CopySection title="おすすめハッシュタグ" text={hashtag.copyText}>
            <TagList label="推奨セット" items={hashtag.recommended} />
            <TagList label="中心タグ" items={hashtag.core} />
            <TagList label="ニッチタグ" items={hashtag.niche} />
            <TagList label="地域タグ" items={hashtag.local} />
            {hashtag.remove.length ? <TagList label="外す候補" items={hashtag.remove} tone="muted" /> : null}
            {hashtag.reason ? <p className="mt-4 text-sm leading-6 text-stone-700">{hashtag.reason}</p> : null}
          </CopySection>
        ) : (
          <List title="おすすめハッシュタグ" items={analysis.hashtags} />
        )}
      </div>

      <section className="rounded-lg border border-stone-200 bg-white/70 p-4">
        <h2 className="font-semibold">分析メモ</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ["投稿の第一印象", analysis.firstImpression],
            ["画像から伝わる内容", analysis.imageMessage],
            ["キャプションのわかりやすさ", analysis.captionClarity],
            ["数値から見た強み", analysis.strengths],
            ["数値から見た弱み", analysis.weaknesses],
            ["伸びた / 伸びなかった可能性", analysis.reason]
          ].map(([title, body]) => (
            <div key={title} className="rounded-md bg-fog p-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-stone-700">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <List title="おすすめ投稿案" items={analysis.nextIdeas} />
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, value * 5));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="font-bold text-ink">{value}/20</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-moss" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-stone-100 text-stone-700"
  };
  const labels = { high: "最優先", medium: "優先", low: "余裕があれば" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[priority]}`}>{labels[priority]}</span>;
}

function ConfidenceBadge({ value }: { value: "high" | "medium" | "low" }) {
  const labels = { high: "信頼度 高", medium: "信頼度 中", low: "信頼度 低" };
  return <span className="mt-3 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-stone-600">{labels[value]}</span>;
}

function CopySection({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="secondary" onClick={() => { void copy(); }}>
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CaptionVariant({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton text={text} />
      </div>
      <p className="mt-3 whitespace-pre-wrap rounded-md bg-fog p-3 text-sm leading-7 text-stone-800">{text}</p>
    </div>
  );
}

function CopyTextCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-stone-200 bg-white/80 px-3 py-3">
      <p className="text-sm leading-6 text-stone-700">
        <span className="mr-2 text-xs font-semibold text-stone-500">{label}</span>
        {text}
      </p>
      <CopyButton text={text} compact />
    </div>
  );
}

function CopyButton({ text, compact = false }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => { void copy(); }}
      className={`shrink-0 rounded-md border border-stone-300 bg-white font-semibold text-stone-700 hover:border-moss ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
    >
      {copied ? "コピー済み" : "コピー"}
    </button>
  );
}

function TagList({ label, items, tone = "normal" }: { label: string; items: string[]; tone?: "normal" | "muted" }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone === "muted" ? "bg-stone-100 text-stone-500 line-through" : "bg-skyglass text-ink"}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function postingEvidenceLabel(value: "account_data" | "post_history" | "general_tendency") {
  if (value === "account_data") return "アカウント固有データ";
  if (value === "post_history") return "過去投稿の実績";
  return "一般的な閲覧傾向";
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
