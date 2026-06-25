'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  loadAllInsightData, loadAnalysesData,
  loadCategoriesData, loadGoalsData, loadPostsData,
  loadSyncRunsData, loadTasksData,
} from "@/lib/cloud-storage";
import {
  ImprovementTask, InstagramInsightSnapshot,
  InstagramPost, InstagramSyncRun, MonthlyGoal,
  PostCategoryDefinition, PostType,
} from "@/lib/types";
import { average, getMetrics, postTypeLabels, taskStatusLabels, weekdayJa } from "@/lib/metrics";
import { calculateInsightGrowth } from "@/lib/insight-growth";

// ── Graph API 型 ──────────────────────────────────────────

interface DashboardData {
  account: {
    name: string;
    username: string;
    followers_count: number;
    biography: string;
    profile_picture_url: string;
    last_synced_at: string;
  } | null;
  totals: {
    posts: number;
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    saved: number;
    shares: number;
    views: number;
  };
  avg_engagement_rate: number;
  top_by_views: MediaItem[];
  top_by_save_rate: (MediaItem & { save_rate: number })[];
  by_day_of_week: Record<number, { count: number; reach: number; likes: number }>;
  by_hour: Record<number, { count: number; reach: number }>;
  by_media_type: Record<string, { count: number; avg_reach: number; avg_views: number }>;
  follower_snapshots: { date: string; followers_count: number }[];
  account_insights_trend: { date: string; reach: number; impressions: number; profile_views: number }[];
}

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  ins?: { views?: number; reach?: number; likes?: number; saved?: number; total_interactions?: number } | null;
}

// ── Manual 型 ──────────────────────────────────────────────

type GrowthAnalysis = {
  summary: string;
  openingPatterns: string[];
  themes: string[];
  formatPatterns: string[];
  hashtagPatterns: string[];
  nextActions: string[];
};

// ── 共通ユーティリティ ─────────────────────────────────────

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const fmt = (v: number | null | undefined) =>
  v == null ? '–' : v.toLocaleString('ja-JP');

// ── Graph API UI コンポーネント ────────────────────────────

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-2xl">{icon}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      <p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function RankRow({ rank, item, value }: { rank: number; item: MediaItem; value: string }) {
  return (
    <a href={`/reel-insights?id=${item.id}`}
      className="flex items-center gap-3 py-2 border-b border-gray-100 hover:bg-gray-50 rounded px-2 transition">
      <span className="text-sm font-bold text-gray-400 w-5">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 truncate">{item.caption ?? '（キャプションなし）'}</p>
        <p className="text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleDateString('ja-JP')} · {item.media_type}
        </p>
      </div>
      <span className="text-sm font-bold text-pink-500 whitespace-nowrap">{value}</span>
    </a>
  );
}

// ── Graph API タブ ────────────────────────────────────────

function GraphApiDashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    fetch('/api/instagram/dashboard')
      .then(r => r.json())
      .then(d => setData(d as DashboardData))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('同期中...');
    try {
      const res = await fetch('/api/instagram/full-sync', { method: 'POST' });
      const d = await res.json() as { ok: boolean; media_fetched: number; insights_fetched: number; error?: string; type?: string };
      if (!res.ok || !d.ok) {
        if (d.type === 'token_expired') setSyncMsg('⚠️ トークンが期限切れです。再連携してください。');
        else if (d.type === 'permission_denied') setSyncMsg('⚠️ 必要なAPI権限がありません。');
        else setSyncMsg(`❌ 同期エラー: ${d.error ?? '不明なエラー'}`);
      } else {
        setSyncMsg(`✅ 同期完了：投稿${d.media_fetched}件 / インサイト${d.insights_fetched}件`);
        const dr = await fetch('/api/instagram/dashboard');
        setData(await dr.json() as DashboardData);
      }
    } catch {
      setSyncMsg('❌ 通信エラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  const totals = data?.totals;
  const account = data?.account;

  const dowData = DOW.map((d, i) => ({
    day: d,
    投稿数: data?.by_day_of_week[i]?.count ?? 0,
    平均リーチ: data?.by_day_of_week[i]?.count
      ? Math.round((data.by_day_of_week[i]?.reach ?? 0) / (data.by_day_of_week[i]?.count ?? 1))
      : 0,
  }));

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}時`,
    投稿数: data?.by_hour[i]?.count ?? 0,
    平均リーチ: data?.by_hour[i]?.count
      ? Math.round((data.by_hour[i]?.reach ?? 0) / (data.by_hour[i]?.count ?? 1))
      : 0,
  }));

  const typeData = Object.entries(data?.by_media_type ?? {}).map(([type, v]) => ({
    type,
    投稿数: v.count,
    平均リーチ: v.avg_reach,
    平均視聴数: v.avg_views,
  }));

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {account?.profile_picture_url && (
            <img src={account.profile_picture_url} alt="profile"
              className="w-14 h-14 rounded-full object-cover border border-gray-200" />
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {account?.name ?? 'Instagram ダッシュボード'}
            </h2>
            {account?.username && (
              <p className="text-sm text-gray-500">@{account.username} · フォロワー {fmt(account.followers_count)}</p>
            )}
            {account?.last_synced_at && (
              <p className="text-xs text-gray-400">
                最終同期: {new Date(account.last_synced_at).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {syncing ? '同期中...' : '🔄 Instagramデータ同期'}
          </button>
          {syncMsg && <p className="text-xs text-gray-600">{syncMsg}</p>}
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="投稿数" value={fmt(totals?.posts)} icon="📝" />
        <SummaryCard label="合計リーチ" value={fmt(totals?.reach)} icon="👁" />
        <SummaryCard label="合計インプレッション" value={fmt(totals?.impressions)} icon="📢" />
        <SummaryCard label="合計閲覧数（動画）" value={fmt(totals?.views)} icon="🎬" />
        <SummaryCard label="合計いいね" value={fmt(totals?.likes)} icon="❤️" />
        <SummaryCard label="合計コメント" value={fmt(totals?.comments)} icon="💬" />
        <SummaryCard label="合計保存" value={fmt(totals?.saved)} icon="🔖" />
        <SummaryCard label="平均エンゲージメント率" value={`${(data?.avg_engagement_rate ?? 0).toFixed(2)}%`} icon="📊" />
      </div>

      {/* フォロワー推移 */}
      {(data?.follower_snapshots?.length ?? 0) > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-700 mb-3">📈 フォロワー推移</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data!.follower_snapshots}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="followers_count" name="フォロワー数" stroke="#ec4899" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* リーチ・インプレッション推移 */}
      {(data?.account_insights_trend?.length ?? 0) > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-700 mb-3">📉 リーチ / インプレッション推移</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data!.account_insights_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="reach" name="リーチ" stroke="#6366f1" dot={false} />
              <Line type="monotone" dataKey="impressions" name="インプレッション" stroke="#f59e0b" dot={false} />
              <Line type="monotone" dataKey="profile_views" name="プロフィール閲覧" stroke="#10b981" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ランキング */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-700 mb-3">🏆 閲覧数ランキング</h2>
          {(data?.top_by_views ?? []).map((item, i) => (
            <RankRow key={item.id} rank={i + 1} item={item} value={fmt(item.ins?.views)} />
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-700 mb-3">🔖 保存率ランキング</h2>
          {(data?.top_by_save_rate ?? []).map((item, i) => (
            <RankRow key={item.id} rank={i + 1} item={item}
              value={`${item.save_rate?.toFixed(1) ?? '–'}%`} />
          ))}
        </div>
      </div>

      {/* 曜日別成果 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-700 mb-3">📅 曜日別の成果</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="投稿数" fill="#ec4899" />
            <Bar yAxisId="right" dataKey="平均リーチ" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 時間帯別成果 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-700 mb-3">🕐 時間帯別の成果</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="投稿数" fill="#f59e0b" />
            <Bar dataKey="平均リーチ" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 投稿タイプ別 */}
      {typeData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-700 mb-3">📸 投稿タイプ別の成果比較</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="平均リーチ" fill="#6366f1" />
              <Bar dataKey="平均視聴数" fill="#ec4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Manual タブ ヘルパー関数 ──────────────────────────────

function videoTitle(post: InstagramPost) {
  const firstLine = post.caption.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || `${post.date}の動画投稿`;
}

function getPostPreview(post: InstagramPost) {
  return post.screenshot || post.thumbnailUrl || post.mediaUrl || "";
}

function GrowthPattern({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-l-2 border-clay pl-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function GrowthSummaryPanel({ title, summary }: { title: string; summary: ReturnType<typeof calculateInsightGrowth> }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        <span className="text-xs text-stone-500">対象 {summary.syncedPosts}投稿</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Insight label="閲覧増加" value={`+${summary.viewsGrowth.toLocaleString()}`} />
        <Insight label="成長率" value={`+${summary.viewsGrowthRate.toFixed(1)}%`} />
        <Insight label="保存増加" value={`+${summary.savedGrowth.toLocaleString()}`} />
        <Insight label="シェア増加" value={`+${summary.sharesGrowth.toLocaleString()}`} />
      </div>
      <div className="mt-4 grid gap-2">
        {summary.topPosts.map((item, index) => (
          <Link key={item.post.id} href={`/posts/detail?id=${item.post.id}`} className="flex items-center justify-between gap-3 border-t border-stone-100 pt-2 text-sm hover:text-clay">
            <span className="line-clamp-1">{index + 1}. {videoTitle(item.post)}</span>
            <span className="shrink-0 font-semibold">+{item.viewsGrowth.toLocaleString()}</span>
          </Link>
        ))}
        {!summary.topPosts.length ? <p className="text-sm text-stone-500">この期間の同期履歴はまだありません。</p> : null}
      </div>
    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTokyoDateHour(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parts.hour
  };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function toTokyoDateKey(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function filterPostsByPeriod(posts: InstagramPost[], period: "7" | "30" | "90" | "all", todayKey: string) {
  if (period === "all") return posts;
  const end = new Date(`${todayKey}T00:00:00+09:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (Number(period) - 1));
  const startKey = toTokyoDateKey(start);
  return posts.filter((post) => post.date >= startKey && post.date <= todayKey);
}

function getNextScheduledSyncTime(now: Date) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  if (next.getMinutes() >= 17) {
    next.setHours(next.getHours() + 1);
  }
  next.setMinutes(17, 0, 0);
  return next;
}

function getLatestExpectedScheduledTime(now: Date) {
  const expected = new Date(now);
  expected.setSeconds(0, 0);
  expected.setMinutes(17, 0, 0);
  if (now.getMinutes() < 17) {
    expected.setHours(expected.getHours() - 1);
  }
  return expected;
}

function getSyncMonitor(now: Date, latestScheduledFinishedAt?: string) {
  const expectedScheduledAt = getLatestExpectedScheduledTime(now);
  const nextScheduledAt = getNextScheduledSyncTime(now);
  const latestScheduledAtMs = latestScheduledFinishedAt ? new Date(latestScheduledFinishedAt).getTime() : 0;
  const expectedAtMs = expectedScheduledAt.getTime();
  const graceMs = 15 * 60 * 1000;
  const isDelayed = now.getTime() >= expectedAtMs + graceMs && latestScheduledAtMs < expectedAtMs;
  return { expectedScheduledAt, nextScheduledAt, isDelayed };
}

function shiftTokyoDateKey(dateKey: string, offsetDays: number) {
  const base = new Date(`${dateKey}T00:00:00+09:00`);
  base.setDate(base.getDate() + offsetDays);
  return toTokyoDateKey(base);
}

function getPreviousRangeKeys(todayKey: string, days: number) {
  const end = shiftTokyoDateKey(todayKey, -days);
  const start = shiftTokyoDateKey(todayKey, -(days * 2) + 1);
  return { start, end };
}

function formatDateTimeJst(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function syncStatusLabel(status: InstagramSyncRun["status"]) {
  if (status === "success") return "成功";
  if (status === "partial") return "一部失敗";
  return "失敗";
}

// ── Manual タブ UI コンポーネント ─────────────────────────

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-base font-bold text-ink">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function CompareStat({
  label, currentDay, previousDay, currentWeek, previousWeek, suffix = "", decimal = false
}: {
  label: string; currentDay: number; previousDay: number;
  currentWeek: number; previousWeek: number; suffix?: string; decimal?: boolean;
}) {
  const renderValue = (value: number) => decimal ? `${value.toFixed(2)}${suffix}` : `${Math.round(value).toLocaleString()}${suffix}`;
  return (
    <div className="rounded-xl border border-stone-200/80 bg-fog/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <div className="mt-3 grid gap-3">
        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-xs font-semibold text-stone-500">前日比</p>
          <p className="mt-1 text-sm font-bold text-ink">{renderValue(currentDay)} / {renderValue(previousDay)}</p>
          <p className="mt-1 text-xs text-stone-600">差分 {renderDelta(currentDay - previousDay, suffix, decimal)}</p>
        </div>
        <div className="rounded-lg bg-white/80 p-3">
          <p className="text-xs font-semibold text-stone-500">前週比</p>
          <p className="mt-1 text-sm font-bold text-ink">{renderValue(currentWeek)} / {renderValue(previousWeek)}</p>
          <p className="mt-1 text-xs text-stone-600">差分 {renderDelta(currentWeek - previousWeek, suffix, decimal)}</p>
        </div>
      </div>
    </div>
  );
}

function renderDelta(value: number, suffix = "", decimal = false) {
  const prefix = value > 0 ? "+" : "";
  return decimal ? `${prefix}${value.toFixed(2)}${suffix}` : `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
}

function SectionLead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-clay">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

function HeroStat({ label, value, note, tone }: {
  label: string; value: string; note: string; tone: "moss" | "clay" | "sky" | "plum";
}) {
  const toneClasses = {
    moss: "from-moss/18 border-moss/20 text-moss",
    clay: "from-clay/18 border-clay/20 text-clay",
    sky: "from-skyglass border-skyglass/90 text-teal-800",
    plum: "from-plum/16 border-plum/20 text-plum"
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-white/90 p-5 shadow-panel ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{note}</p>
    </div>
  );
}

function Progress({ label, actual, target, suffix, decimal = false }: {
  label: string; actual: number; target: number; suffix: string; decimal?: boolean;
}) {
  const rate = target > 0 ? Math.min((actual / target) * 100, 999) : 0;
  const actualText = decimal ? actual.toFixed(2) : Math.round(actual).toLocaleString();
  const targetText = decimal ? target.toFixed(2) : Math.round(target).toLocaleString();
  return (
    <div className="rounded-md border border-stone-200/80 bg-fog/80 p-4">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-ink">{target > 0 ? `${rate.toFixed(0)}%` : "未設定"}</p>
      <p className="mt-1 text-xs text-stone-600">実績 {actualText}{suffix} / 目標 {targetText}{suffix}</p>
      <div className="mt-3 h-2 rounded-full bg-white">
        <div className="h-2 rounded-full bg-moss" style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

function ChartPanel({ title, description, accent, children }: {
  title: string; description: string; accent: "moss" | "clay" | "sky" | "plum"; children: React.ReactElement;
}) {
  const accentClasses = { moss: "bg-moss", clay: "bg-clay", sky: "bg-teal-700", plum: "bg-plum" };
  return (
    <Panel className="relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1 ${accentClasses[accent]}`} />
      <div className="pl-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ── Manual タブ ────────────────────────────────────────────

function ManualDashboardTab() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [categories, setCategories] = useState<PostCategoryDefinition[]>([]);
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [insightDate, setInsightDate] = useState("");
  const [latestScoreByPostId, setLatestScoreByPostId] = useState<Record<string, number>>({});
  const [videoPeriod, setVideoPeriod] = useState<"day" | "week" | "month">("day");
  const [graphPeriod, setGraphPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [syncRuns, setSyncRuns] = useState<InstagramSyncRun[]>([]);
  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysis | null>(null);
  const [growthAnalysisLoading, setGrowthAnalysisLoading] = useState(false);
  const [growthAnalysisError, setGrowthAnalysisError] = useState("");
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncErrorMessage, setSyncErrorMessage] = useState("");

  const refreshDashboard = async () => {
    const [loadedPosts, loadedTasks, loadedGoals, loadedInsights, loadedCategories, loadedSyncRuns] = await Promise.all([
      loadPostsData(),
      loadTasksData(),
      loadGoalsData(),
      loadAllInsightData(),
      loadCategoriesData(),
      loadSyncRunsData()
    ]);
    setPosts(loadedPosts);
    setTasks(loadedTasks);
    setGoals(loadedGoals);
    setInsightHistory(loadedInsights);
    setSyncRuns(loadedSyncRuns);
    const latestInsight = [...loadedInsights].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
    if (latestInsight) setInsightDate(toTokyoDateHour(latestInsight.capturedAt).date);
    setCategories(loadedCategories);
    Promise.all(loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const)).then((scores) => {
      setLatestScoreByPostId(Object.fromEntries(scores.filter(([, score]) => typeof score === "number")));
    });
  };

  useEffect(() => { refreshDashboard(); }, []);

  const hourlyInsightData = useMemo(() => {
    if (!insightDate) return [];
    const targetPostIds = new Set(posts.map((post) => post.id));
    const snapshotsByHour = new Map<string, Map<string, InstagramInsightSnapshot>>();
    for (const snapshot of insightHistory) {
      if (!targetPostIds.has(snapshot.postId)) continue;
      const captured = toTokyoDateHour(snapshot.capturedAt);
      if (captured.date !== insightDate) continue;
      const postsInHour = snapshotsByHour.get(captured.hour) ?? new Map<string, InstagramInsightSnapshot>();
      const current = postsInHour.get(snapshot.postId);
      if (!current || new Date(snapshot.capturedAt).getTime() > new Date(current.capturedAt).getTime()) {
        postsInHour.set(snapshot.postId, snapshot);
      }
      snapshotsByHour.set(captured.hour, postsInHour);
    }
    let previousViews: number | null = null;
    return [...snapshotsByHour.entries()]
      .sort(([hourA], [hourB]) => hourA.localeCompare(hourB))
      .map(([hour, snapshots]) => {
        const views = [...snapshots.values()].reduce((sum, snapshot) => sum + snapshot.views, 0);
        const growth = previousViews === null ? 0 : Math.max(views - previousViews, 0);
        previousViews = views;
        return { hour: `${hour}:00`, views, growth, postCount: snapshots.size };
      });
  }, [posts, insightHistory, insightDate]);

  const periodGrowth = useMemo(() => {
    return {
      week: calculateInsightGrowth(posts, insightHistory, 7),
      month: calculateInsightGrowth(posts, insightHistory, 30)
    };
  }, [posts, insightHistory]);

  const growingVideos = useMemo(() => {
    const periodDays = videoPeriod === "day" ? 1 : videoPeriod === "week" ? 7 : 30;
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    const targetPosts = posts.filter((post) => post.type === "video" || post.type === "reel");
    const snapshotsByPostId = new Map<string, InstagramInsightSnapshot[]>();
    for (const snapshot of insightHistory) {
      const current = snapshotsByPostId.get(snapshot.postId) ?? [];
      current.push(snapshot);
      snapshotsByPostId.set(snapshot.postId, current);
    }
    return targetPosts.flatMap((post) => {
      const snapshots = (snapshotsByPostId.get(post.id) ?? [])
        .filter((snapshot) => new Date(snapshot.capturedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      if (!snapshots.length) return [];
      const first = snapshots[0];
      const latest = snapshots[snapshots.length - 1];
      const growth = snapshots.length >= 2 ? Math.max(latest.views - first.views, 0) : latest.views;
      return [{ post, growth, views: latest.views, reach: latest.reach, snapshotCount: snapshots.length }];
    }).sort((a, b) => b.growth - a.growth || b.views - a.views).slice(0, 5);
  }, [posts, insightHistory, videoPeriod]);

  const analyzeGrowingVideos = async () => {
    if (!growingVideos.length) return;
    if (!window.confirm("上位動画の共通点をOpenAI APIで分析します。API料金が発生します。実行しますか？")) return;
    setGrowthAnalysisLoading(true);
    setGrowthAnalysisError("");
    try {
      const response = await fetch("/api/instagram/growth-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: growingVideos, period: videoPeriod, account: null })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "共通点分析に失敗しました。");
      setGrowthAnalysis(data.analysis);
    } catch (error) {
      setGrowthAnalysisError(error instanceof Error ? error.message : "共通点分析に失敗しました。");
    } finally {
      setGrowthAnalysisLoading(false);
    }
  };

  const runSyncNow = async () => {
    setSyncingNow(true);
    setSyncMessage("");
    setSyncErrorMessage("");
    try {
      const response = await fetch("/api/instagram/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(data.error ?? "同期に失敗しました。");
      await refreshDashboard();
      setSyncMessage(data.success
        ? `${data.savedPosts}件の投稿と${data.savedSnapshots}件の履歴を保存しました。`
        : `${data.savedPosts}件を保存しましたが、一部でエラーが発生しました。`);
    } catch (error) {
      setSyncErrorMessage(error instanceof Error ? error.message : "同期に失敗しました。");
    } finally {
      setSyncingNow(false);
    }
  };

  const data = useMemo(() => {
    const targetPosts = posts;
    const todayKey = toTokyoDateKey(new Date());
    const graphPosts = filterPostsByPeriod(targetPosts, graphPeriod, todayKey);
    const currentMonthKey = currentMonth();
    const monthlyPosts = targetPosts.filter((post) => post.date.startsWith(currentMonthKey));
    const todayPosts = targetPosts.filter((post) => post.date === todayKey);
    const yesterdayKey = shiftTokyoDateKey(todayKey, -1);
    const previousDayPosts = targetPosts.filter((post) => post.date === yesterdayKey);
    const last7 = filterPostsByPeriod(targetPosts, "7", todayKey);
    const prev7Range = getPreviousRangeKeys(todayKey, 7);
    const previous7Posts = targetPosts.filter((post) => post.date >= prev7Range.start && post.date <= prev7Range.end);
    const latestTodayPost = [...todayPosts].sort((a, b) => {
      const byUpdated = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (byUpdated !== 0) return byUpdated;
      return a.date < b.date ? 1 : -1;
    })[0];
    const monthlyActual = {
      posts: monthlyPosts.length,
      views: monthlyPosts.reduce((sum, post) => sum + post.views, 0),
      saves: monthlyPosts.reduce((sum, post) => sum + post.saves, 0),
      saveRate: average(monthlyPosts.map((post) => getMetrics(post).saveRate)),
      engagementRate: average(monthlyPosts.map((post) => getMetrics(post).engagementRate))
    };
    const selectedGoal = goals.find((goal) => goal.month === currentMonthKey && goal.accountId == null) ?? goals.find((goal) => goal.month === currentMonthKey) ?? null;
    const postById = Object.fromEntries(posts.map((post) => [post.id, post]));
    const targetTasks = tasks;
    const today = toDateKey(new Date());
    const openTasks = targetTasks.filter((task) => task.status !== "done");
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const completedTasks = targetTasks.filter((task) => task.status === "done");
    const completionRate = targetTasks.length ? (completedTasks.length / targetTasks.length) * 100 : 0;
    const dailyViews = Array.from(
      graphPosts.reduce((daily, post) => {
        daily.set(post.date, (daily.get(post.date) ?? 0) + post.views);
        return daily;
      }, new Map<string, number>())
    ).sort(([dateA], [dateB]) => dateA.localeCompare(dateB)).map(([date, views]) => ({ name: date.slice(5), date, views }));
    const typeData = (["image", "video", "reel", "carousel"] as PostType[]).map((type) => {
      const items = graphPosts.filter((post) => post.type === type);
      return {
        name: postTypeLabels[type],
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2))
      };
    });
    const weekdayData = ["日", "月", "火", "水", "木", "金", "土"].map((day) => {
      const items = graphPosts.filter((post) => weekdayJa(post.date) === day);
      return { name: day, averageEngagementRate: Number(average(items.map((post) => getMetrics(post).engagementRate)).toFixed(2)) };
    });
    const categoryData = categories.map((category) => {
      const items = graphPosts.filter((post) => (post.category ?? "other") === category.value);
      const scores = items.map((post) => latestScoreByPostId[post.id]).filter((score): score is number => typeof score === "number");
      const categoryPostIds = new Set(items.map((post) => post.id));
      const categoryTasks = targetTasks.filter((task) => task.postId && categoryPostIds.has(task.postId));
      return {
        name: category.label,
        averageViews: Math.round(average(items.map((post) => post.views))),
        averageSaveRate: Number(average(items.map((post) => getMetrics(post).saveRate)).toFixed(2)),
        averageAiScore: Number(average(scores).toFixed(1)),
        taskCount: categoryTasks.length,
        openTaskCount: categoryTasks.filter((task) => task.status !== "done").length,
        count: items.length
      };
    });
    const taskStatusData = (["todo", "doing", "done"] as const).map((status) => ({
      name: taskStatusLabels[status],
      count: targetTasks.filter((task) => task.status === status).length
    }));
    const taskCategoryData = categoryData.filter((item) => item.taskCount > 0);
    const nextTask = [...openTasks].filter((task) => task.dueDate).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    return {
      dailyViews, typeData, weekdayData, categoryData, taskStatusData, taskCategoryData,
      saveRank: [...graphPosts].sort((a, b) => b.saves - a.saves).slice(0, 5).map((post) => ({ name: post.date, saves: post.saves })),
      likeRank: [...graphPosts].sort((a, b) => b.likes - a.likes).slice(0, 5).map((post) => ({ name: post.date, likes: post.likes })),
      totalViews: targetPosts.reduce((sum, post) => sum + post.views, 0),
      averageEngagementRate: average(targetPosts.map((post) => getMetrics(post).engagementRate)),
      averageSaves: average(targetPosts.map((post) => post.saves)),
      bestType: [...typeData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      bestWeekday: [...weekdayData].sort((a, b) => b.averageEngagementRate - a.averageEngagementRate)[0],
      bestCategory: [...categoryData].filter((item) => item.count > 0).sort((a, b) => b.averageSaveRate - a.averageSaveRate)[0],
      bestAiScoreCategory: [...categoryData].filter((item) => item.averageAiScore > 0).sort((a, b) => b.averageAiScore - a.averageAiScore)[0],
      mostSavedPost: [...targetPosts].sort((a, b) => b.saves - a.saves)[0],
      currentMonthKey, monthlyActual, selectedGoal,
      taskCount: targetTasks.length, openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length, completionRate, nextTask,
      nextTaskPost: nextTask?.postId ? postById[nextTask.postId] : undefined,
      count: targetPosts.length, graphCount: graphPosts.length,
      graphPeriodLabel: graphPeriod === "7" ? "直近7日" : graphPeriod === "30" ? "直近30日" : graphPeriod === "90" ? "直近90日" : "全期間",
      todayPosts, todayViews: todayPosts.reduce((sum, post) => sum + post.views, 0),
      todaySaves: todayPosts.reduce((sum, post) => sum + post.saves, 0),
      todayEngagementRate: average(todayPosts.map((post) => getMetrics(post).engagementRate)),
      latestTodayPost, todayKey,
      previousDayViews: previousDayPosts.reduce((sum, post) => sum + post.views, 0),
      previousDaySaves: previousDayPosts.reduce((sum, post) => sum + post.saves, 0),
      previousDayEngagementRate: average(previousDayPosts.map((post) => getMetrics(post).engagementRate)),
      last7Views: last7.reduce((sum, post) => sum + post.views, 0),
      last7Saves: last7.reduce((sum, post) => sum + post.saves, 0),
      last7EngagementRate: average(last7.map((post) => getMetrics(post).engagementRate)),
      previous7Views: previous7Posts.reduce((sum, post) => sum + post.views, 0),
      previous7Saves: previous7Posts.reduce((sum, post) => sum + post.saves, 0),
      previous7EngagementRate: average(previous7Posts.map((post) => getMetrics(post).engagementRate))
    };
  }, [posts, tasks, goals, latestScoreByPostId, categories, graphPeriod]);

  const latestSyncRun = syncRuns[0] ?? null;
  const latestScheduledSyncRun = syncRuns.find((run) => run.triggerType === "scheduled") ?? null;
  const latestSyncError = syncRuns.find((run) => run.status !== "success") ?? null;
  const showPastSyncError = Boolean(latestSyncError && latestSyncRun && latestSyncRun.id !== latestSyncError.id);
  const pastSyncError = showPastSyncError ? latestSyncError : null;
  const syncMonitor = useMemo(() => getSyncMonitor(new Date(), latestScheduledSyncRun?.finishedAt), [latestScheduledSyncRun?.finishedAt]);
  const latestSyncFinishedAt = latestSyncRun ? new Date(latestSyncRun.finishedAt) : null;
  const latestSyncAgeMs = latestSyncFinishedAt ? Date.now() - latestSyncFinishedAt.getTime() : Number.POSITIVE_INFINITY;
  const hasFreshTodaySync = Boolean(
    latestSyncRun?.status === "success" &&
    latestSyncFinishedAt &&
    toTokyoDateKey(latestSyncFinishedAt) === data.todayKey &&
    latestSyncAgeMs <= 2 * 60 * 60 * 1000
  );
  const showTodayMissingAlert = Boolean(
    hasFreshTodaySync && !syncMonitor.isDelayed &&
    data.todayPosts.length === 0 && new Date().getHours() >= 12
  );
  const syncStatusValue = syncMonitor.isDelayed
    ? "同期遅延"
    : latestScheduledSyncRun
      ? syncStatusLabel(latestScheduledSyncRun.status)
      : latestSyncRun?.triggerType === "manual"
        ? "手動のみ"
        : latestSyncRun ? syncStatusLabel(latestSyncRun.status) : "履歴なし";
  const syncDiagnosis = useMemo(() => {
    if (!syncMonitor.isDelayed) return null;
    if (!latestScheduledSyncRun && latestSyncRun?.triggerType === "manual") {
      return {
        action: "GitHub Actions と CRON_SECRET の一致確認を優先してください。",
        title: "手動同期は動いていますが、自動同期だけ記録されていません",
        summary: "Instagram API や保存処理ではなく、自動実行の起動経路に問題がある可能性が高い状態です。",
        checks: [
          "GitHub Actions の Instagram hourly sync が 20:17 台に実行されているか",
          "GitHub Actions 側の CRON_SECRET が設定されているか",
          "Vercel 側の CRON_SECRET と同じ値になっているか"
        ]
      };
    }
    if (!latestScheduledSyncRun) {
      return {
        action: "自動同期の起動設定と秘密鍵の設定有無を確認してください。",
        title: "自動同期の履歴がまだ 1 件もありません",
        summary: "GitHub Actions から Vercel の同期 API まで到達できていない可能性があります。",
        checks: [
          "GitHub Actions のワークフローが有効か",
          "GitHub Secrets に CRON_SECRET が入っているか",
          "Vercel の環境変数に CRON_SECRET が入っているか"
        ]
      };
    }
    return {
      action: "直近の Actions 実行ログと認証設定のずれを確認してください。",
      title: "前回の自動同期以降、次の定時実行が記録されていません",
      summary: "前回までは自動同期できていたため、一時的な実行失敗か認証ずれの可能性があります。",
      checks: [
        "直近の GitHub Actions 実行ログで curl が失敗していないか",
        "CRON_SECRET を最近変更していないか",
        "Vercel 側のデプロイ後に環境変数が反映されているか"
      ]
    };
  }, [latestScheduledSyncRun, latestSyncRun, syncMonitor.isDelayed]);

  return (
    <div>
      <PageHeader title="ダッシュボード" description="投稿データをグラフで確認し、成果が出やすい型を探します。" />
      <Panel className="mb-6 overflow-hidden border-stone-200/80 bg-gradient-to-br from-white/92 via-white/80 to-skyglass/50">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-clay">Overview</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">いま見るべき数値を先に確認</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            投稿数、表示数、保存傾向、改善タスクの進み具合をまとめて確認できます。
          </p>
        </div>
      </Panel>
      {!data.count ? <Panel><p className="text-sm text-stone-600">対象の投稿データがありません。登録ページからサンプルデータを追加できます。</p></Panel> : null}
      {data.count ? (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Panel className="border-stone-200/80 bg-white/88">
              <SectionLead eyebrow="Sync" title="同期状況" description="自動反映のタイミングと、最後の同期結果をすぐ確認できます。" />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={runSyncNow} disabled={syncingNow}>{syncingNow ? "同期中..." : "今すぐ再実行"}</Button>
                {syncMessage ? <p className="text-sm text-emerald-700">{syncMessage}</p> : null}
                {syncErrorMessage ? <p className="text-sm text-red-700">{syncErrorMessage}</p> : null}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Insight label="最終同期時刻" value={latestSyncRun ? formatDateTimeJst(latestSyncRun.finishedAt) : "未同期"} />
                <Insight label="最終自動同期" value={latestScheduledSyncRun ? formatDateTimeJst(latestScheduledSyncRun.finishedAt) : "未記録"} />
                <Insight label="次回同期予定" value={formatDateTimeJst(syncMonitor.nextScheduledAt.toISOString())} />
                <Insight label="同期状態" value={syncStatusValue} />
              </div>
              {syncMonitor.isDelayed ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">定時同期が遅れています</p>
                  <p className="mt-1">予定時刻 {formatDateTimeJst(syncMonitor.expectedScheduledAt.toISOString())} の自動同期がまだ記録されていません。</p>
                  <p className="mt-2 text-xs text-amber-700">最終同期時刻: {latestSyncRun ? formatDateTimeJst(latestSyncRun.finishedAt) : "未同期"}</p>
                  <p className="mt-1 text-xs text-amber-700">最終自動同期: {latestScheduledSyncRun ? formatDateTimeJst(latestScheduledSyncRun.finishedAt) : "未記録"}</p>
                  {syncDiagnosis ? (
                    <div className="mt-3 grid gap-3 rounded-lg border border-amber-200/80 bg-white/60 p-3">
                      <div className="rounded-md border border-amber-100 bg-amber-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">今やること</p>
                        <p className="mt-1 text-sm font-semibold text-amber-950">{syncDiagnosis.action}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold tracking-[0.12em] text-amber-900">推定原因</span>
                        <p className="text-xs font-semibold text-amber-900">{syncDiagnosis.title}</p>
                      </div>
                      <p className="text-xs text-amber-800">{syncDiagnosis.summary}</p>
                      <div className="rounded-md border border-amber-100 bg-amber-50/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">確認順</p>
                        <ol className="mt-2 grid gap-2 text-xs text-amber-800">
                          {syncDiagnosis.checks.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">GitHub Actions の実行履歴、`CRON_SECRET`、Vercel の環境変数を確認してください。</p>
                  )}
                </div>
              ) : null}
              {latestSyncRun ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-stone-200/80 bg-fog/70 p-4 md:grid-cols-4">
                  <MiniMetric label="取得投稿" value={`${latestSyncRun.fetchedPosts}件`} />
                  <MiniMetric label="投稿保存" value={`${latestSyncRun.savedPosts}件`} />
                  <MiniMetric label="履歴保存" value={`${latestSyncRun.savedSnapshots}件`} />
                  <MiniMetric label="失敗" value={`${latestSyncRun.failedPosts}件`} />
                </div>
              ) : null}
              {latestSyncRun?.status === "failed" && latestSyncError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  <p className="font-semibold">最新の同期エラー</p>
                  <p className="mt-1">{latestSyncError.errorSummary || "同期でエラーが発生しました。"}</p>
                  <p className="mt-2 text-xs text-red-700">発生時刻: {formatDateTimeJst(latestSyncError.finishedAt)}</p>
                </div>
              ) : null}
              {latestSyncRun?.status === "partial" && latestSyncError ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">最新の同期で一部エラーが発生しました</p>
                  <p className="mt-1">{latestSyncError.errorSummary || "一部のデータ保存に失敗しました。"}</p>
                  <p className="mt-2 text-xs text-amber-700">発生時刻: {formatDateTimeJst(latestSyncError.finishedAt)}</p>
                </div>
              ) : null}
              {latestSyncRun?.status === "success" && pastSyncError ? (
                <div className="mt-4 rounded-xl border border-stone-200 bg-white/75 p-4 text-sm leading-6 text-stone-700">
                  <p className="font-semibold text-ink">前回の失敗履歴</p>
                  <p className="mt-1">{pastSyncError.errorSummary || "前回の同期でエラーが発生しました。"}</p>
                  <p className="mt-2 text-xs text-stone-500">発生時刻: {formatDateTimeJst(pastSyncError.finishedAt)}</p>
                </div>
              ) : null}
            </Panel>
            <Panel className="border-stone-200/80 bg-gradient-to-br from-white/92 to-oat/70">
              <SectionLead eyebrow="Today" title="今日の投稿" description="日次確認に必要な投稿数、表示数、直近投稿をまとめています。" />
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                <Insight label="今日の投稿件数" value={`${data.todayPosts.length}件`} />
                <Insight label="今日の表示数合計" value={data.todayViews.toLocaleString()} />
              </div>
              {showTodayMissingAlert ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">今日の投稿が未取得の可能性があります</p>
                  <p className="mt-1">直近2時間以内の同期は成功していますが、{data.todayKey} の投稿が0件です。今日投稿している場合は、再同期かアカウント紐づけを確認してください。</p>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-stone-200/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">直近投稿</p>
                {data.latestTodayPost ? (
                  <>
                    <p className="mt-2 line-clamp-2 font-semibold text-ink">{videoTitle(data.latestTodayPost)}</p>
                    <p className="mt-2 text-sm text-stone-600">表示数 {data.latestTodayPost.views.toLocaleString()} / 保存 {data.latestTodayPost.saves.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-stone-500">投稿日 {data.latestTodayPost.date}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-stone-600">{data.todayKey} の投稿はまだありません。</p>
                )}
              </div>
            </Panel>
          </div>
          <Panel className="mb-6">
            <SectionLead eyebrow="Compare" title="前回比" description="表示数、保存数、ER の前日比と前週比をひと目で比較できます。" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <CompareStat label="表示数" currentDay={data.todayViews} previousDay={data.previousDayViews} currentWeek={data.last7Views} previousWeek={data.previous7Views} />
              <CompareStat label="保存数" currentDay={data.todaySaves} previousDay={data.previousDaySaves} currentWeek={data.last7Saves} previousWeek={data.previous7Saves} />
              <CompareStat label="平均ER" currentDay={data.todayEngagementRate} previousDay={data.previousDayEngagementRate} currentWeek={data.last7EngagementRate} previousWeek={data.previous7EngagementRate} suffix="%" decimal />
            </div>
          </Panel>
          <Panel className="mb-6">
            <SectionLead eyebrow="History" title="同期履歴一覧" description="直近20回の実行結果を確認できます。失敗時の原因もここから追えます。" />
            <div className="mt-4 overflow-auto">
              <table>
                <thead>
                  <tr>
                    <th>実行時刻</th><th>種別</th><th>状態</th><th>取得</th><th>投稿保存</th><th>履歴保存</th><th>エラー内容</th>
                  </tr>
                </thead>
                <tbody>
                  {syncRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{formatDateTimeJst(run.finishedAt)}</td>
                      <td>{run.triggerType === "manual" ? "手動" : "自動"}</td>
                      <td>{syncStatusLabel(run.status)}</td>
                      <td>{run.fetchedPosts.toLocaleString()}件</td>
                      <td>{run.savedPosts.toLocaleString()}件</td>
                      <td>{run.savedSnapshots.toLocaleString()}件</td>
                      <td>{run.errorSummary || "-"}</td>
                    </tr>
                  ))}
                  {!syncRuns.length ? (
                    <tr><td colSpan={7} className="text-center text-stone-500">同期履歴はまだありません。</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
          <section className="mb-6 border-y border-stone-200 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">伸びている動画ランキング</h2>
                <p className="mt-1 text-sm text-stone-600">同期履歴から期間内の閲覧数増加を比較します。</p>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-stone-200 bg-white/80 p-1" aria-label="動画ランキング期間">
                {(["day", "week", "month"] as const).map((period) => (
                  <button key={period} type="button"
                    onClick={() => { setVideoPeriod(period); setGrowthAnalysis(null); setGrowthAnalysisError(""); }}
                    className={`h-9 min-w-16 rounded px-3 text-sm font-semibold transition ${videoPeriod === period ? "bg-ink text-white" : "text-stone-600 hover:bg-fog"}`}
                  >
                    {period === "day" ? "日" : period === "week" ? "週" : "月"}
                  </button>
                ))}
              </div>
            </div>
            {growingVideos.length ? (
              <div className="mt-5 grid gap-2">
                {growingVideos.map((item, index) => (
                  <Link key={item.post.id} href={`/posts/detail?id=${item.post.id}`}
                    className="grid gap-3 border-b border-stone-200 px-2 py-4 transition hover:bg-white/60 md:grid-cols-[52px_64px_1fr_auto] md:items-center">
                    <span className="text-2xl font-bold text-clay">{index + 1}</span>
                    {getPostPreview(item.post) ? (
                      <img src={getPostPreview(item.post)} alt="投稿サムネイル" className="h-16 w-16 rounded-md object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-md bg-fog text-[10px] text-stone-500">画像なし</span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{videoTitle(item.post)}</span>
                      <span className="mt-1 block text-xs text-stone-500">投稿日 {item.post.date} / リーチ {item.reach.toLocaleString()}</span>
                    </span>
                    <span className="text-left md:text-right">
                      <span className="block text-lg font-bold text-ink">+{item.growth.toLocaleString()} 閲覧</span>
                      <span className="mt-1 block text-xs text-stone-500">現在 {item.views.toLocaleString()} / 履歴 {item.snapshotCount}回</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-md border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-600">この期間に同期された動画データがありません。</p>
            )}
            <p className="mt-3 text-xs leading-5 text-stone-500">期間内の履歴が1回だけの場合は、現在の閲覧数を増加値として表示します。継続同期すると実際の差分になります。</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={analyzeGrowingVideos} disabled={!growingVideos.length || growthAnalysisLoading}>
                {growthAnalysisLoading ? "共通点を分析中..." : "上位動画の共通点をAI分析"}
              </Button>
              {growthAnalysisError ? <p className="text-sm text-red-700">{growthAnalysisError}</p> : null}
            </div>
            {growthAnalysis ? (
              <div className="mt-6 border-t border-stone-200 pt-5">
                <h3 className="font-semibold text-ink">AIによる共通点分析</h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">{growthAnalysis.summary}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <GrowthPattern title="冒頭文・フック" items={growthAnalysis.openingPatterns} />
                  <GrowthPattern title="テーマ" items={growthAnalysis.themes} />
                  <GrowthPattern title="動画形式・構成" items={growthAnalysis.formatPatterns} />
                  <GrowthPattern title="ハッシュタグ" items={growthAnalysis.hashtagPatterns} />
                  <GrowthPattern title="次回アクション" items={growthAnalysis.nextActions} />
                </div>
              </div>
            ) : null}
          </section>
          <Panel className="mb-6">
            <SectionLead eyebrow="Highlights" title="読み取りポイント" description="相対的に強い曜日、投稿タイプ、カテゴリをひと目で拾えるように整理しています。" />
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <Insight label="反応が良い投稿タイプ" value={data.bestType?.averageEngagementRate ? `${data.bestType.name} / ${data.bestType.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="反応が良い曜日" value={data.bestWeekday?.averageEngagementRate ? `${data.bestWeekday.name}曜日 / ${data.bestWeekday.averageEngagementRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="保存されやすいカテゴリ" value={data.bestCategory ? `${data.bestCategory.name} / ${data.bestCategory.averageSaveRate.toFixed(2)}%` : "データ不足"} />
              <Insight label="AI評価が高いカテゴリ" value={data.bestAiScoreCategory ? `${data.bestAiScoreCategory.name} / ${data.bestAiScoreCategory.averageAiScore.toFixed(1)}点` : "分析履歴なし"} />
              <Insight label="保存されやすい投稿" value={data.mostSavedPost ? `${data.mostSavedPost.date} / ${data.mostSavedPost.saves.toLocaleString()}保存` : "データ不足"} />
            </div>
          </Panel>
          <Panel className="mb-6">
            <SectionLead eyebrow="Tasks" title="改善タスク進捗" description="進み具合だけでなく、次に手を付ける期限付きタスクもすぐ確認できます。" />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Insight label="未完了タスク" value={`${data.openTaskCount}件`} />
              <Insight label="完了率" value={`${data.completionRate.toFixed(1)}%`} />
              <Insight label="期限切れ" value={`${data.overdueTaskCount}件`} />
              <Insight label="次の期限" value={data.nextTask ? `${data.nextTask.dueDate} / ${data.nextTaskPost?.date ?? "投稿未紐づけ"}` : "期限付きタスクなし"} />
            </div>
          </Panel>
          <Panel className="mb-6">
            <SectionLead eyebrow="Goals" title="今月の目標達成率" description="今月の実績と目標値の差を指標ごとに比較します。" />
            {data.selectedGoal ? (
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Progress label="投稿数" actual={data.monthlyActual.posts} target={data.selectedGoal.targetPosts} suffix="件" />
                <Progress label="表示数" actual={data.monthlyActual.views} target={data.selectedGoal.targetViews} suffix="" />
                <Progress label="保存数" actual={data.monthlyActual.saves} target={data.selectedGoal.targetSaves} suffix="" />
                <Progress label="平均保存率" actual={data.monthlyActual.saveRate} target={data.selectedGoal.targetSaveRate} suffix="%" decimal />
                <Progress label="平均ER" actual={data.monthlyActual.engagementRate} target={data.selectedGoal.targetEngagementRate} suffix="%" decimal />
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-600">{data.currentMonthKey} の目標は未設定です。目標管理ページで設定できます。</p>
            )}
          </Panel>
        </>
      ) : null}
      <section className="mt-8">
        <SectionLead eyebrow="Charts" title="推移と比較" description="時系列の流れ、投稿タイプ差、カテゴリ差を横断して確認できるグラフ群です。" />
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-stone-600">{data.graphPeriodLabel}の投稿 {data.graphCount}件をもとに集計しています。</p>
          <div className="grid grid-cols-4 gap-1 rounded-md border border-stone-200 bg-white/80 p-1">
            {(["7", "30", "90", "all"] as const).map((period) => (
              <button key={period} type="button" onClick={() => setGraphPeriod(period)}
                className={`rounded px-3 py-2 text-sm font-semibold transition ${graphPeriod === period ? "bg-ink text-white" : "text-stone-600 hover:bg-fog"}`}>
                {period === "all" ? "全期間" : `${period}日`}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="日別表示数の推移" description="投稿日ごとの表示数の流れです。大きく伸びた日を先に把握できます。" accent="clay">
          <LineChart data={data.dailyViews}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="views" name="表示数" stroke="#b55d3e" strokeWidth={2} /></LineChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均表示数" description="動画・画像など、形式ごとの平均表示数を比較します。" accent="moss">
          <BarChart data={data.typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageViews" name="平均表示数" fill="#53624a" /></BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均表示数" description="どのテーマが見られやすいかをカテゴリ単位で見ます。" accent="moss">
          <BarChart data={data.categoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageViews" name="平均表示数" fill="#4f6b57" /></BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均保存率" description="保存されやすいテーマを特定するための比較です。" accent="sky">
          <BarChart data={data.categoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageSaveRate" name="平均保存率" fill="#2f766d" /></BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の平均AIスコア" description="AI評価の高いカテゴリをまとめて確認します。" accent="plum">
          <BarChart data={data.categoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="averageAiScore" name="平均AIスコア" fill="#5a4356" /></BarChart>
        </ChartPanel>
        <ChartPanel title="改善タスクの状態別件数" description="未着手、進行中、完了の件数バランスです。" accent="clay">
          <BarChart data={data.taskStatusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="タスク数" fill="#b55d3e" /></BarChart>
        </ChartPanel>
        <ChartPanel title="カテゴリ別の改善タスク数" description="改善の集中先をカテゴリ別に見ます。" accent="moss">
          <BarChart data={data.taskCategoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="taskCount" name="全タスク" fill="#53624a" /><Bar dataKey="openTaskCount" name="未完了" fill="#b55d3e" /></BarChart>
        </ChartPanel>
        <ChartPanel title="投稿タイプ別の平均エンゲージメント率" description="反応率が高い投稿形式を比較します。" accent="clay">
          <BarChart data={data.typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#b55d3e" /></BarChart>
        </ChartPanel>
        <ChartPanel title="曜日別の平均エンゲージメント率" description="反応が出やすい曜日の偏りを確認します。" accent="sky">
          <BarChart data={data.weekdayData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageEngagementRate" name="平均エンゲージメント率" fill="#2f766d" /></BarChart>
        </ChartPanel>
        <ChartPanel title="保存数ランキング" description="保存されやすかった投稿を上位順に見ます。" accent="moss">
          <BarChart data={data.saveRank}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="saves" name="保存数" fill="#53624a" /></BarChart>
        </ChartPanel>
        <ChartPanel title="いいね数ランキング" description="いいね数の上位投稿を一覧で確認します。" accent="clay">
          <BarChart data={data.likeRank}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="likes" name="いいね数" fill="#b55d3e" /></BarChart>
        </ChartPanel>
      </div>
      <Panel className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">時間別の閲覧数変化</h2>
            <p className="mt-1 text-sm text-stone-600">自動同期で保存したインサイトを、選択日の1時間ごとに表示します。</p>
          </div>
          <div className="w-full sm:w-52">
            <label htmlFor="insight-date">表示する日</label>
            <input id="insight-date" type="date" value={insightDate} onChange={(event) => setInsightDate(event.target.value)} />
          </div>
        </div>
        {hourlyInsightData.length ? (
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyInsightData}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="hour" /><YAxis />
                <Tooltip formatter={(value: number, name: string) => [Number(value).toLocaleString(), name]} />
                <Legend />
                <Line type="monotone" dataKey="views" name="合計閲覧数" stroke="#b55d3e" strokeWidth={2} />
                <Line type="monotone" dataKey="growth" name="前回からの増加" stroke="#2f766d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-5 rounded-md bg-fog p-4 text-sm text-stone-600">選択日の同期履歴はまだありません。</p>
        )}
      </Panel>
      <section className="mt-6 border-y border-stone-200 py-6">
        <SectionLead eyebrow="Growth" title="週・月の伸び" description="Instagram API の同期履歴から、期間内にどれだけ増えたかを比較します。" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <GrowthSummaryPanel title="直近7日" summary={periodGrowth.week} />
          <GrowthSummaryPanel title="直近30日" summary={periodGrowth.month} />
        </div>
      </section>
    </div>
  );
}

// ── 共通サマリーカード ────────────────────────────────────

function SummaryStatsSection() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPostsData().then(p => { setPosts(p); setLoaded(true); });
  }, []);

  if (!loaded) return null;

  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const avgER = average(posts.map(p => getMetrics(p).engagementRate));
  const avgSaves = average(posts.map(p => p.saves));

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <HeroStat label="対象投稿" value={`${posts.length}件`} note="全投稿合計" tone="moss" />
      <HeroStat label="合計表示数" value={totalViews.toLocaleString()} note="最新の投稿データを合算" tone="clay" />
      <HeroStat label="平均ER" value={`${avgER.toFixed(2)}%`} note="投稿ごとの平均値" tone="sky" />
      <HeroStat label="平均保存数" value={Math.round(avgSaves).toLocaleString()} note="1投稿あたりの平均" tone="plum" />
    </div>
  );
}

// ── メインページ（タブ切り替え） ───────────────────────────

export default function DashboardPage() {
  const [tab, setTab] = useState<'manual' | 'graphapi'>('graphapi');

  return (
    <div>
      <SummaryStatsSection />
      <div className="flex gap-0 border-b border-stone-200 mb-6">
        <button
          onClick={() => setTab('graphapi')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${tab === 'graphapi' ? 'border-pink-500 text-pink-600' : 'border-transparent text-stone-500 hover:text-ink'}`}
        >
          Instagram APIデータ
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${tab === 'manual' ? 'border-ink text-ink' : 'border-transparent text-stone-500 hover:text-ink'}`}
        >
          投稿管理データ
        </button>
      </div>
      {tab === 'manual' ? <ManualDashboardTab /> : <GraphApiDashboardTab />}
    </div>
  );
}
