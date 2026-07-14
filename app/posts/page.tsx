"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, Stat } from "@/components/ui";
import { loadAnalysesData, loadPostsData } from "@/lib/cloud-storage";
import { InstagramPost } from "@/lib/types";
import { formatPercent, getMetrics } from "@/lib/metrics";
import { mergePostMetrics, matchPostToMedia, type MetricSource, type ApiMedia } from "@/lib/post-merge";

// ── 型 ──────────────────────────────────────────────────────

type USort = "date" | "views" | "reach" | "likes" | "saves" | "engagementRate";
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

function formatVideoDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "–";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes === 0) return `${remainingSeconds}秒`;
  return `${minutes}分${remainingSeconds.toString().padStart(2, "0")}秒`;
}

// ── UI コンポーネント ────────────────────────────────────────

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
  const [sortKey, setSortKey] = useState<USort>("date");
  const [typeFilter, setTypeFilter] = useState<UTypeFilter>("");
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

  if (loading) return <div><PageHeader title="投稿一覧" description="読み込み中..." /></div>;

  const apiMatchCount = unifiedList.filter((e) => e.post && e.hasApi).length;
  const supplementOnlyCount = unifiedList.filter((e) => e.post && !e.hasApi).length;
  const apiOnlyCount = unifiedList.filter((e) => !e.post).length;

  return (
    <div>
      <PageHeader
        title="投稿一覧"
        description={`API同期 ${apiMatchCount}件 / 未取得 ${supplementOnlyCount}件 / API履歴のみ ${apiOnlyCount}件`}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <Stat label="表示中の件数" value={`${filteredList.length}件`} />
        <Stat label="平均表示数" value={Math.round(filteredList.reduce((sum, entry) => sum + entry.views, 0) / Math.max(filteredList.length, 1)).toLocaleString("ja-JP")} />
        <Stat label="平均保存数" value={Math.round(filteredList.reduce((sum, entry) => sum + entry.saves, 0) / Math.max(filteredList.length, 1)).toLocaleString("ja-JP")} />
        <Stat label="平均ER" value={formatPercent(filteredList.reduce((sum, entry) => sum + entry.er, 0) / Math.max(filteredList.length, 1))} />
      </div>

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
            <option value="engagementRate">反応率順</option>
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
        <span className="text-sm text-stone-500 self-end pb-1.5">{filteredList.length} 件</span>
      </div>
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
      : <span className="inline-block text-[9px] font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full leading-none">未取得</span>;

  const body = (
    <>
      <div className="aspect-[4/3] bg-fog">
        {entry.thumbnail ? (
          <Image
            src={entry.thumbnail}
            alt="投稿サムネイル"
            fill
            unoptimized
            className="object-cover transition group-hover:scale-[1.02]"
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
              {entry.post ? "未取得" : "API履歴のみ"}
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
            <span className="block text-[11px] font-semibold text-stone-500">反応率</span>
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
