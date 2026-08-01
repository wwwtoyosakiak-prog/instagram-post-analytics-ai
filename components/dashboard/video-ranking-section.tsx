import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { GrowthPattern, SourceBadge } from "@/components/dashboard/widgets";
import { getPostPreview, videoTitle } from "@/components/dashboard/utils";
import type { GrowthAnalysis } from "@/components/dashboard/types";
import type { InstagramPost } from "@/lib/types";

export type VideoRankingPeriod = "day" | "week" | "month";

type GrowingVideo = {
  post: InstagramPost;
  growth: number;
  views: number;
  reach: number;
  snapshotCount: number;
  hasApiData: boolean;
};

export function VideoRankingSection({ period, onPeriodChange, videos, analysis, analysisLoading, analysisError, onAnalyze }: {
  period: VideoRankingPeriod;
  onPeriodChange: (period: VideoRankingPeriod) => void;
  videos: GrowingVideo[];
  analysis: GrowthAnalysis | null;
  analysisLoading: boolean;
  analysisError: string;
  onAnalyze: () => void;
}) {
  return (
    <section className="mb-6 border-y border-stone-200 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">伸びている動画ランキング</h2>
          <p className="mt-1 text-sm text-stone-600">同期履歴から期間内の閲覧数増加を比較します。</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-stone-200 bg-white/80 p-1" aria-label="動画ランキング期間">
          {(["day", "week", "month"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={period === option} onClick={() => onPeriodChange(option)} className={`h-9 min-w-16 rounded px-3 text-sm font-semibold transition ${period === option ? "bg-ink text-white" : "text-stone-600 hover:bg-fog"}`}>
              {option === "day" ? "日" : option === "week" ? "週" : "月"}
            </button>
          ))}
        </div>
      </div>
      {videos.length ? (
        <div className="mt-5 grid gap-2">
          {videos.map((item, index) => {
            const preview = getPostPreview(item.post);
            return (
              <Link key={item.post.id} href={`/posts/detail?id=${item.post.id}`} className="grid gap-3 border-b border-stone-200 px-2 py-4 transition hover:bg-white/60 md:grid-cols-[52px_64px_1fr_auto] md:items-center">
                <span className="text-2xl font-bold text-clay">{index + 1}</span>
                {preview ? <Image src={preview} alt="投稿サムネイル" width={64} height={64} unoptimized className="h-16 w-16 rounded-md object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-md bg-fog text-[10px] text-stone-500">画像なし</span>}
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5"><span className="block truncate font-semibold text-ink">{videoTitle(item.post)}</span><SourceBadge source={item.hasApiData ? "api" : "manual"} /></span>
                  <span className="mt-1 block text-xs text-stone-500">投稿日 {item.post.date} / リーチ {item.reach.toLocaleString()}</span>
                </span>
                <span className="text-left md:text-right"><span className="block text-lg font-bold text-ink">+{item.growth.toLocaleString()} 閲覧</span><span className="mt-1 block text-xs text-stone-500">現在 {item.views.toLocaleString()} / 履歴 {item.snapshotCount}回</span></span>
              </Link>
            );
          })}
        </div>
      ) : <p className="mt-5 rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">この期間に同期された動画データがありません。</p>}
      <p className="mt-3 text-xs leading-5 text-stone-500">期間内の履歴が1回だけの場合は、現在の閲覧数を増加値として表示します。継続同期すると実際の差分になります。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onAnalyze} disabled={!videos.length || analysisLoading}>{analysisLoading ? "共通点を分析中..." : "上位動画の共通点をAI分析"}</Button>
        {analysisError ? <p className="text-sm text-red-700">{analysisError}</p> : null}
      </div>
      {analysis ? (
        <div className="mt-6 border-t border-stone-200 pt-5">
          <h3 className="font-semibold text-ink">AIによる共通点分析</h3>
          <p className="mt-2 text-sm leading-6 text-stone-700">{analysis.summary}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GrowthPattern title="冒頭文・フック" items={analysis.openingPatterns} /><GrowthPattern title="テーマ" items={analysis.themes} /><GrowthPattern title="動画形式・構成" items={analysis.formatPatterns} /><GrowthPattern title="ハッシュタグ" items={analysis.hashtagPatterns} /><GrowthPattern title="次回アクション" items={analysis.nextActions} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
