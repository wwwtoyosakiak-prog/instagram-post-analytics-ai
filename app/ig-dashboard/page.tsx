'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';

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

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const fmt = (v: number | null | undefined) =>
  v == null ? '–' : v.toLocaleString('ja-JP');

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
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 rounded px-2">
      <span className="text-sm font-bold text-gray-400 w-5">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 truncate">{item.caption ?? '（キャプションなし）'}</p>
        <p className="text-xs text-gray-400">
          {new Date(item.timestamp).toLocaleDateString('ja-JP')} · {item.media_type}
        </p>
      </div>
      <span className="text-sm font-bold text-pink-500 whitespace-nowrap">{value}</span>
    </div>
  );
}

export default function IgDashboardPage() {
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {account?.profile_picture_url && (
            <img src={account.profile_picture_url} alt="profile"
              className="w-14 h-14 rounded-full object-cover border border-gray-200" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {account?.name ?? 'Instagram ダッシュボード'}
            </h1>
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
          <button onClick={handleSync} disabled={syncing}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
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
