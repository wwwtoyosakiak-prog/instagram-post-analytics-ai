"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { loadAnalysesData, loadPostsData, saveAnalysisData } from "@/lib/cloud-storage";
import { AiAnalysis, InstagramPost } from "@/lib/types";
import { formatPercent, getMetrics } from "@/lib/metrics";
import { mergePostMetrics, matchPostToMedia, type MetricSource, type ApiMedia } from "@/lib/post-merge";

// ── 型 ──────────────────────────────────────────────────────

type USort = "date" | "views" | "reach" | "likes" | "saves" | "engagementRate";
type ViewMode = "table" | "cards";
type UTypeFilter = "" | "video" | "image" | "carousel";

interface UnifiedEntry {
  key: string;
  date: string;
  caption: string;
  normalizedType: UTypeFilter | null;
  permalink: string | null;
  thumbnail: string | null;
  mediaUrl: string | null;
  views: number; viewsSrc: MetricSource;
  likes: number; likesSrc: MetricSource;
  saves: number; savesSrc: MetricSource;
  comments: number; commentsSrc: MetricSource;
  shares: number;
  reach: number | null;
  totalInteractions: number;
  profileVisits: number;
  follows: number;
  reelAvgWatchTimeMs: number | null;
  reelTotalViewTimeMs: number | null;
  er: number;
  post: InstagramPost | null;
  media: ApiMedia | null;
  hasApi: boolean;
}

// ── ヘルパー ────────────────────────────────────────────────

function normalizeType(apiType?: string | null, manualType?: string | null): UTypeFilter | null {
  if (apiType === "VIDEO") return "video";
  if (apiType === "IMAGE") return "image";
  if (apiType === "CAROUSEL_ALBUM") return "carousel";
  if (manualType === "video" || manualType === "reel") return "video";
  if (manualType === "image") return "image";
  if (manualType === "carousel") return "carousel";
  return null;
}

function toJSTDate(value?: string) {
  if (!value) return "未記録";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatWatchTime(ms: number | null): string {
  if (ms == null) return "–";
  const s = ms / 1000;
  if (s >= 60) return `${Math.floor(s / 60)}分${Math.round(s % 60)}秒`;
  return `${s.toFixed(1)}秒`;
}

function formatVideoDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "–";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes === 0) return `${remainingSeconds}秒`;
  return `${minutes}分${remainingSeconds.toString().padStart(2, "0")}秒`;
}

// ── UI コンポーネント ────────────────────────────────────────

function SourceBadge({ source }: { source: MetricSource }) {
  return source === "api"
    ? <span className="inline-block text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full leading-none">API</span>
    : <span className="inline-block text-[9px] font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full leading-none">補完</span>;
}

function TypeBadge({ type }: { type: UTypeFilter | null }) {
  if (!type) return null;
  const cls =
    type === "video" ? "bg-pink-100 text-pink-600"
    : type === "carousel" ? "bg-blue-100 text-blue-600"
    : "bg-stone-100 text-stone-600";
  const label =
    type === "video" ? "リール/動画"
    : type === "carousel" ? "カルーセル"
    : "画像";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

// ── メインページ ────────────────────────────────────────────

export default function PostsPage() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [apiMedia, setApiMedia] = useState<ApiMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const [sortKey, setSortKey] = useState<USort>("date");
  const [typeFilter, setTypeFilter] = useState<UTypeFilter>("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [videoDurationByUrl, setVideoDurationByUrl] = useState<Record<string, number | null>>({});

  useEffect(() => {
    Promise.all([
      loadPostsData(),
      fetch("/api/instagram/media?limit=100")
        .then((r) => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] })),
    ]).then(([loadedPosts, mediaJson]) => {
      setPosts(loadedPosts);
      setApiMedia((mediaJson as { data: ApiMedia[] }).data ?? []);
      setLoading(false);
      Promise.all(
        loadedPosts.map(async (p) => [p.id, (await loadAnalysesData(p.id))[0]?.score] as const)
      ).then((scores) => {
        setLatestScoreByPostId(Object.fromEntries(scores.filter(([, s]) => typeof s === "number")));
      });
    });
  }, []);

  // ── 統合リスト ─────────────────────────────────────────────

  const unifiedList = useMemo((): UnifiedEntry[] => {
    const matchedIds = new Set<string>();

    const manualEntries: UnifiedEntry[] = posts.map((post) => {
      const matched = matchPostToMedia(post, apiMedia);
      if (matched) matchedIds.add(matched.id);
      const ins = matched?.latest_insights;
      const m = mergePostMetrics(post, ins);
      return {
        key: post.id,
        date: post.date,
        caption: post.caption,
        normalizedType: normalizeType(matched?.media_type, post.type),
        permalink: post.url ?? matched?.permalink ?? null,
        thumbnail: (post.screenshot || post.thumbnailUrl || post.mediaUrl || matched?.thumbnail_url) ?? null,
        mediaUrl: post.mediaUrl ?? matched?.media_url ?? null,
        views: m.views, viewsSrc: m.viewsSrc,
        likes: m.likes, likesSrc: m.likesSrc,
        saves: m.saves, savesSrc: m.savesSrc,
        comments: m.comments, commentsSrc: m.commentsSrc,
        shares: m.shares,
        reach: ins?.reach ?? null,
        totalInteractions: ins?.total_interactions ?? 0,
        profileVisits: ins?.profile_visits ?? 0,
        follows: ins?.follows ?? 0,
        reelAvgWatchTimeMs: matched?.media_product_type === "REELS" ? (ins?.ig_reels_avg_watch_time ?? null) : null,
        reelTotalViewTimeMs: matched?.media_product_type === "REELS" ? (ins?.ig_reels_video_view_total_time ?? null) : null,
        er: getMetrics({ views: m.views, likes: m.likes, saves: m.saves, comments: m.comments, shares: m.shares }).engagementRate,
        post,
        media: matched ?? null,
        hasApi: !!(ins && ((ins.views != null && ins.views > 0) || (ins.reach != null && ins.reach > 0))),
      };
    });

    const apiOnlyEntries: UnifiedEntry[] = apiMedia
      .filter((m) => !matchedIds.has(m.id))
      .map((m) => {
        const ins = m.latest_insights;
        const date = new Date(m.timestamp).toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 10);
        const views = ins?.views ?? 0;
        const likes = ins?.likes ?? 0;
        const saves = ins?.saved ?? 0;
        const comments = ins?.comments ?? 0;
        const shares = ins?.shares ?? 0;
        return {
          key: `api-${m.id}`,
          date,
          caption: m.caption ?? "",
          normalizedType: normalizeType(m.media_type, null),
          permalink: m.permalink,
          thumbnail: m.thumbnail_url ?? m.media_url ?? null,
          mediaUrl: m.media_url ?? null,
          views, viewsSrc: "api" as MetricSource,
          likes, likesSrc: "api" as MetricSource,
          saves, savesSrc: "api" as MetricSource,
          comments, commentsSrc: "api" as MetricSource,
          shares,
          reach: ins?.reach ?? null,
          totalInteractions: ins?.total_interactions ?? 0,
          profileVisits: ins?.profile_visits ?? 0,
          follows: ins?.follows ?? 0,
          reelAvgWatchTimeMs: m.media_product_type === "REELS" ? (ins?.ig_reels_avg_watch_time ?? null) : null,
          reelTotalViewTimeMs: m.media_product_type === "REELS" ? (ins?.ig_reels_video_view_total_time ?? null) : null,
          er: views > 0 ? ((likes + saves + comments + shares) / views) * 100 : 0,
          post: null,
          media: m,
          hasApi: true,
        };
      });

    return [...manualEntries, ...apiOnlyEntries];
  }, [posts, apiMedia]);

  useEffect(() => {
    const pendingUrls = unifiedList
      .filter((entry) => entry.normalizedType === "video" && entry.mediaUrl && !(entry.mediaUrl in videoDurationByUrl))
      .map((entry) => entry.mediaUrl as string);

    if (pendingUrls.length === 0) return;

    const uniqueUrls = [...new Set(pendingUrls)];
    const videos: HTMLVideoElement[] = [];
    let cancelled = false;

    uniqueUrls.forEach((url) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;

      const finalize = (duration: number | null) => {
        if (cancelled) return;
        setVideoDurationByUrl((current) => (url in current ? current : { ...current, [url]: duration }));
      };

      video.onloadedmetadata = () => {
        finalize(Number.isFinite(video.duration) ? video.duration : null);
      };
      video.onerror = () => finalize(null);
      videos.push(video);
    });

    return () => {
      cancelled = true;
      videos.forEach((video) => {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [unifiedList, videoDurationByUrl]);

  // ── フィルタ＋ソート ──────────────────────────────────────

  const filteredList = useMemo(() => {
    return unifiedList
      .filter((e) => !typeFilter || e.normalizedType === typeFilter)
      .sort((a, b) => {
        if (sortKey === "date") return b.date.localeCompare(a.date);
        if (sortKey === "views") return b.views - a.views;
        if (sortKey === "reach") return (b.reach ?? -1) - (a.reach ?? -1);
        if (sortKey === "likes") return b.likes - a.likes;
        if (sortKey === "saves") return b.saves - a.saves;
        if (sortKey === "engagementRate") return b.er - a.er;
        return 0;
      });
  }, [unifiedList, typeFilter, sortKey]);

  // ── AI評価（保存済み投稿が対象） ────────────────────────────

  const manualFilteredPosts = useMemo(
    () => filteredList.filter((e) => e.post !== null).map((e) => e.post!),
    [filteredList]
  );

  const analyzeFilteredPosts = async (onlyMissing: boolean) => {
    const targets = manualFilteredPosts.filter(
      (p) => !onlyMissing || typeof latestScoreByPostId[p.id] !== "number"
    );
    if (!targets.length) {
      setAiMessage(onlyMissing ? "未分析の投稿はありません。" : "評価できる投稿がありません。");
      return;
    }
    const limited = targets.slice(0, 10);
    const confirmText = onlyMissing
      ? `表示中の未分析投稿 ${limited.length}件をOpenAI APIで評価します。API料金が発生します。実行しますか？`
      : `表示中の投稿 ${limited.length}件をOpenAI APIで再評価します。API料金が発生します。実行しますか？`;
    if (!window.confirm(confirmText)) return;
    setAiLoading(true);
    setAiMessage(`AI評価を開始しました。0/${limited.length}件`);
    let success = 0;
    try {
      for (const post of limited) {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post, account: null }),
        });
        const d = await res.json() as { error?: string; analysis: AiAnalysis };
        if (!res.ok) throw new Error(d.error ?? "AI評価に失敗しました。");
        const saved = await saveAnalysisData(post.id, d.analysis);
        const score = (saved as { score?: number } | null)?.score ?? d.analysis?.score as number | undefined;
        if (typeof score === "number") setLatestScoreByPostId((cur) => ({ ...cur, [post.id]: score }));
        success += 1;
        setAiMessage(`AI評価中です。${success}/${limited.length}件完了`);
      }
      setAiMessage(`AI評価が完了しました。${success}件を評価・保存しました。`);
    } catch (err) {
      setAiMessage(
        err instanceof Error
          ? `AI評価が途中で止まりました。${success}件完了。理由: ${err.message}`
          : `AI評価が途中で止まりました。${success}件完了。`
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div><PageHeader title="投稿一覧" description="読み込み中..." /></div>;

  const apiMatchCount = unifiedList.filter((e) => e.post && e.hasApi).length;
  const supplementOnlyCount = unifiedList.filter((e) => e.post && !e.hasApi).length;
  const apiOnlyCount = unifiedList.filter((e) => !e.post).length;

  return (
    <div>
      <PageHeader
        title="投稿一覧"
        description={`API同期 ${apiMatchCount}件 / 補完データ ${supplementOnlyCount}件 / API履歴のみ ${apiOnlyCount}件`}
      />

      {/* AI評価 */}
      <Panel className="mb-5 bg-fog/80">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">実投稿のAI評価</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              保存済み投稿をOpenAI APIで評価し、スコア・改善案を保存します。絞り込み結果に連動します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => analyzeFilteredPosts(true)} disabled={aiLoading}>
              {aiLoading ? "評価中..." : "未分析をAI評価"}
            </Button>
            <Button variant="secondary" onClick={() => analyzeFilteredPosts(false)} disabled={aiLoading}>
              表示中を再評価
            </Button>
          </div>
        </div>
        {aiMessage && (
          <p className="mt-3 rounded-md bg-skyglass px-3 py-2 text-sm text-ink">{aiMessage}</p>
        )}
        <p className="mt-2 text-xs text-stone-500">一度に評価する投稿は最大10件。</p>
      </Panel>

      {/* フィルターバー */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-stone-500 mb-1">並び替え</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as USort)}
            className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="date">投稿日順</option>
            <option value="views">表示数順</option>
            <option value="reach">リーチ順</option>
            <option value="likes">いいね順</option>
            <option value="saves">保存順</option>
            <option value="engagementRate">ER順</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">投稿タイプ</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as UTypeFilter)}
            className="text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="">すべて</option>
            <option value="video">リール/動画</option>
            <option value="image">画像</option>
            <option value="carousel">カルーセル</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">表示形式</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`h-8 px-3 rounded-md border text-sm font-semibold ${viewMode === "table" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-stone-700"}`}
            >
              表
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`h-8 px-3 rounded-md border text-sm font-semibold ${viewMode === "cards" ? "border-ink bg-ink text-white" : "border-stone-200 bg-white text-stone-700"}`}
            >
              カード
            </button>
          </div>
        </div>
        <span className="text-sm text-stone-500 self-end pb-1.5">{filteredList.length} 件</span>
      </div>

      {/* テーブルビュー */}
      {viewMode === "table" && (
        <div className="overflow-auto rounded-xl border border-stone-200 bg-white shadow-panel">
          <table>
            <thead>
              <tr>
                <th>投稿</th>
                <th>投稿日</th>
                <th>タイプ</th>
                <th>キャプション</th>
                <th>表示数</th>
                <th>リーチ</th>
                <th>いいね</th>
                <th>保存</th>
                <th>コメント</th>
                <th>シェア</th>
                <th>総IA</th>
                <th>PFアクセス</th>
                <th>フォロー</th>
                <th>総再生時間</th>
                <th>平均視聴</th>
                <th>動画尺</th>
                <th>ER</th>
                <th>AIスコア</th>
                <th>詳細・分析</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((e) => (
                <tr key={e.key}>
                  <td>
                    {e.thumbnail ? (
                      <img src={e.thumbnail} alt="" className="h-14 w-14 rounded-md object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-md bg-fog text-[10px] text-stone-500">
                        なし
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{toJSTDate(e.date)}</td>
                  <td><TypeBadge type={e.normalizedType} /></td>
                  <td className="max-w-xs">
                    <p className="line-clamp-2 text-sm">{e.caption || "（なし）"}</p>
                  </td>
                  <td>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{e.views.toLocaleString("ja-JP")}</span>
                      <SourceBadge source={e.viewsSrc} />
                    </div>
                  </td>
                  <td>{e.reach != null ? e.reach.toLocaleString("ja-JP") : "–"}</td>
                  <td>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{e.likes.toLocaleString("ja-JP")}</span>
                      <SourceBadge source={e.likesSrc} />
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{e.saves.toLocaleString("ja-JP")}</span>
                      <SourceBadge source={e.savesSrc} />
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{e.comments.toLocaleString("ja-JP")}</span>
                      <SourceBadge source={e.commentsSrc} />
                    </div>
                  </td>
                  <td>{e.shares.toLocaleString("ja-JP")}</td>
                  <td>{e.totalInteractions > 0 ? e.totalInteractions.toLocaleString("ja-JP") : "–"}</td>
                  <td>{e.profileVisits > 0 ? e.profileVisits.toLocaleString("ja-JP") : "–"}</td>
                  <td>{e.follows > 0 ? e.follows.toLocaleString("ja-JP") : "–"}</td>
                  <td>{formatWatchTime(e.reelTotalViewTimeMs)}</td>
                  <td>{formatWatchTime(e.reelAvgWatchTimeMs)}</td>
                  <td>{e.normalizedType === "video" ? formatVideoDuration(e.mediaUrl ? videoDurationByUrl[e.mediaUrl] ?? null : null) : "–"}</td>
                  <td>{formatPercent(e.er)}</td>
                  <td>
                    {e.post
                      ? typeof latestScoreByPostId[e.post.id] === "number"
                        ? `${latestScoreByPostId[e.post.id]}点`
                        : "未分析"
                      : "–"}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {e.post && (
                        <Link
                          className="text-xs font-semibold text-clay hover:underline"
                          href={`/posts/detail?id=${e.post.id}`}
                        >
                          詳細・分析
                        </Link>
                      )}
                      {!e.post && e.permalink && (
                        <a
                          className="text-xs font-semibold text-stone-500 hover:underline"
                          href={e.permalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          IG
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredList.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-500">投稿がありません。</p>
          )}
        </div>
      )}

      {/* カードビュー */}
      {viewMode === "cards" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredList.map((e) => (
            <UnifiedCard
              key={e.key}
              entry={e}
              aiScore={e.post ? latestScoreByPostId[e.post.id] : undefined}
              videoDurationSeconds={e.mediaUrl ? videoDurationByUrl[e.mediaUrl] ?? null : null}
            />
          ))}
          {filteredList.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-500 md:col-span-2 xl:col-span-3">
              投稿がありません。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── サブコンポーネント ──────────────────────────────────────

function UnifiedCard({
  entry,
  aiScore,
  videoDurationSeconds,
}: {
  entry: UnifiedEntry;
  aiScore?: number;
  videoDurationSeconds: number | null;
}) {
  const cls =
    "group overflow-hidden rounded-lg border border-stone-200 bg-white/82 shadow-panel transition hover:border-moss hover:bg-white";

  const sourceBadge = (src: MetricSource) =>
    src === "api"
      ? <span className="inline-block text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full leading-none">API</span>
      : <span className="inline-block text-[9px] font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full leading-none">補完</span>;

  const body = (
    <>
      <div className="aspect-[4/3] bg-fog">
        {entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt="投稿サムネイル"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500">
            画像なし
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <TypeBadge type={entry.normalizedType} />
          {entry.post && (
            <span className="rounded-full bg-skyglass px-2 py-1 text-[11px] font-semibold text-ink">
              AI {typeof aiScore === "number" ? `${aiScore}点` : "未分析"}
            </span>
          )}
          {entry.hasApi ? (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
              API同期済み
            </span>
          ) : (
            <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-500">
              {entry.post ? "補完データ" : "API履歴のみ"}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-stone-500">{toJSTDate(entry.date)}</p>
        <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm font-semibold leading-6 text-ink">
          {entry.caption || "投稿コメントなし"}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-fog px-2 py-2">
            <span className="block text-[11px] font-semibold text-stone-500">表示</span>
            <span className="mt-1 block font-bold text-ink">{entry.views.toLocaleString("ja-JP")}</span>
            {sourceBadge(entry.viewsSrc)}
          </div>
          <div className="rounded-md bg-fog px-2 py-2">
            <span className="block text-[11px] font-semibold text-stone-500">保存</span>
            <span className="mt-1 block font-bold text-ink">{entry.saves.toLocaleString("ja-JP")}</span>
            {sourceBadge(entry.savesSrc)}
          </div>
          <div className="rounded-md bg-fog px-2 py-2">
            <span className="block text-[11px] font-semibold text-stone-500">ER</span>
            <span className="mt-1 block font-bold text-ink">{formatPercent(entry.er)}</span>
          </div>
        </div>
        {entry.normalizedType === "video" ? (
          <div className="mt-3 rounded-md bg-fog px-3 py-2 text-xs text-stone-600">
            <span className="font-semibold text-stone-500">動画尺</span>
            <span className="ml-2 font-bold text-ink">
              {formatVideoDuration(videoDurationSeconds)}
            </span>
          </div>
        ) : null}
        {entry.post ? (
          <span className="mt-3 block rounded-md bg-pink-500 px-3 py-1.5 text-center text-xs font-bold text-white">
            詳細・分析を見る
          </span>
        ) : null}
      </div>
    </>
  );

  if (entry.post) {
    return (
      <Link href={`/posts/detail?id=${entry.post.id}`} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
