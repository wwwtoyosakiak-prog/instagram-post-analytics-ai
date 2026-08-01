import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadingBlock, Stat } from "@/components/ui";
import type { InstagramInsightSnapshot } from "@/lib/types";
import type { ApiMedia } from "@/lib/post-merge";

export function InsightTrend({ snapshots }: { snapshots: InstagramInsightSnapshot[] }) {
  const [range, setRange] = useState<"1d" | "7d" | "14d" | "30d">("7d");
  const rows = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    const latestAt = new Date(sorted[sorted.length - 1]?.capturedAt ?? Date.now()).getTime();
    const rangeDays = { "1d": 1, "7d": 7, "14d": 14, "30d": 30 }[range];
    const startAt = latestAt - rangeDays * 24 * 60 * 60 * 1000;
    const filtered = sorted.filter((snapshot) => new Date(snapshot.capturedAt).getTime() >= startAt);
    const baseViews = filtered[0]?.views ?? 0;
    return filtered.map((snapshot) => ({
      date: new Date(snapshot.capturedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      閲覧数: snapshot.views,
      増加ビュー数: snapshot.views - baseViews,
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
      <p className="mb-4 text-sm text-stone-600">選んだ期間の最初を0として、ビュー数の増え方を確認できます。現在 {rows.length} 回分です。</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="期間の最初" value={firstViews != null ? firstViews.toLocaleString() : "–"} />
        <Stat label="最新ビュー数" value={latestViews != null ? latestViews.toLocaleString() : "–"} />
        <Stat label="増減" value={viewsDelta != null ? `${viewsDelta >= 0 ? "+" : ""}${viewsDelta.toLocaleString()}` : "–"} />
      </div>
      {rows.length ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={28} /><YAxis allowDecimals={false} domain={[0, "auto"]} /><Tooltip /><Legend />
              <Line type="monotone" dataKey="増加ビュー数" stroke="#53624a" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">この期間のビュー履歴はまだありません。</div>}
    </section>
  );
}

function RangeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-md border px-3 py-2 text-sm font-medium transition ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}>{children}</button>;
}

export function LatestInsightSection({ insight, loading, isReel, apiInsights }: {
  insight: InstagramInsightSnapshot | null;
  loading: boolean;
  isReel: boolean;
  apiInsights: ApiMedia["latest_insights"] | null;
}) {
  const value = (number: number | null | undefined) => number != null ? number.toLocaleString() : "–";
  return (
    <section className="mt-7 border-y border-stone-200 py-6">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div><h2 className="text-lg font-bold text-ink">最新のInstagramインサイト</h2><p className="mt-1 text-sm text-stone-600">Instagram Graph APIから同期した最新値です。</p></div>
        {insight ? <p className="text-xs font-semibold text-stone-500">取得日時: {formatDateTime(insight.capturedAt)}</p> : null}
      </div>
      {loading ? (
        <div role="status" aria-label="インサイトを読み込み中" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <LoadingBlock key={index} className="h-24" />)}</div>
      ) : insight ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="閲覧数" value={value(insight.views)} /><Stat label="リーチ" value={value(insight.reach)} /><Stat label="いいね数" value={value(insight.likes)} /><Stat label="保存数" value={value(insight.saved)} /><Stat label="コメント数" value={value(insight.comments)} /><Stat label="シェア数" value={value(insight.shares)} /><Stat label="総反応数" value={value(insight.totalInteractions)} /><Stat label="プロフィールアクセス" value={value(insight.profileVisits)} /><Stat label="フォロー数" value={value(insight.follows)} />
          </div>
          {isReel && insight.reelAvgWatchTime != null ? (
            <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-pink-600">リール指標</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="平均視聴時間" value={formatWatchTime(insight.reelAvgWatchTime)} /><Stat label="総再生時間" value={formatWatchTime(insight.reelTotalViewTime)} /><Stat label="再生回数" value={value(apiInsights?.plays)} /><Stat label="リプレイ回数" value={value(insight.reelClipsReplaysCount)} /></div>
            </div>
          ) : null}
        </div>
      ) : <div className="rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">この投稿のインサイトはまだありません。Graph APIページで同期後、再度確認してください。</div>}
    </section>
  );
}

function formatWatchTime(ms: number | null) {
  if (ms == null) return "–";
  const seconds = ms / 1000;
  return seconds >= 60 ? `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒` : `${seconds.toFixed(1)}秒`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}
