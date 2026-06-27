'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';

// ── 型 ────────────────────────────────────────────────────

interface Media {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  comments_count?: number | null;
}

interface Insight {
  captured_at: string;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  saved?: number | null;
  shares?: number | null;
  total_interactions?: number | null;
  follows?: number | null;
  profile_visits?: number | null;
  ig_reels_avg_watch_time?: number | null;
  ig_reels_video_view_total_time?: number | null;
}

interface ReelAverage {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  saved?: number | null;
  shares?: number | null;
  total_interactions?: number | null;
  follows?: number | null;
  profile_visits?: number | null;
  ig_reels_avg_watch_time?: number | null;
}

// ── ユーティリティ ────────────────────────────────────────

const fmt = (v: number | null | undefined, digits = 0) =>
  v == null ? '未取得' : v.toLocaleString('ja-JP', { maximumFractionDigits: digits });

const pct = (num: number | null | undefined, den: number | null | undefined) => {
  if (num == null || den == null || den === 0) return null;
  return (num / den) * 100;
};

const fmtPct = (v: number | null | undefined) =>
  v == null ? '未取得' : `${v.toFixed(2)}%`;

const fmtSec = (ms: number | null | undefined) => {
  if (ms == null) return '未取得';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}分${s % 60}秒`;
};

const fmtApiMetric = (v: number | null | undefined) =>
  v == null ? 'API未返却' : v.toLocaleString('ja-JP');

const fmtApiPct = (v: number | null | undefined) =>
  v == null ? 'API未返却' : `${v.toFixed(2)}%`;

const fmtApiSec = (ms: number | null | undefined) => {
  if (ms == null) return 'API未返却';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}分${s % 60}秒`;
};

// ── メトリクスカード ──────────────────────────────────────

function MetricCard({
  label, value, sub, highlight,
}: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-pink-600' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── 比較バー ──────────────────────────────────────────────

function CompareBar({
  label, value, avg,
}: { label: string; value: number | null | undefined; avg: number | null | undefined }) {
  if (value == null && avg == null) return null;
  const v = value ?? 0;
  const a = avg ?? 0;
  const max = Math.max(v, a, 1);
  const better = v >= a;
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded h-4 relative">
          <div
            className={`absolute left-0 top-0 h-4 rounded ${better ? 'bg-pink-400' : 'bg-blue-300'}`}
            style={{ width: `${(v / max) * 100}%` }}
          />
        </div>
        <span className="text-xs w-20 text-right font-bold">{fmt(v)}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <div className="flex-1 bg-gray-100 rounded h-4 relative">
          <div
            className="absolute left-0 top-0 h-4 rounded bg-gray-300"
            style={{ width: `${(a / max) * 100}%` }}
          />
        </div>
        <span className="text-xs w-20 text-right text-gray-400">平均 {fmt(a)}</span>
      </div>
    </div>
  );
}

// ── AIコメントセクション ──────────────────────────────────

function AiAnalysis({
  latest, avg,
  mediaComments,
}: { latest: Insight | null; avg: ReelAverage | null; mediaComments?: number | null }) {
  const [aiText, setAiText] = useState('');
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const prompt = buildAiPrompt(latest, avg, mediaComments);
      const res = await fetch('/api/analysis/reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { result?: string };
      setAiText(data.result ?? 'AI分析に失敗しました。');
    } catch {
      setAiText('AI分析に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-bold text-gray-700 mb-3">🤖 AI分析</h3>
      {!aiText && (
        <button
          onClick={analyze}
          disabled={loading}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? '分析中...' : 'AI分析を実行'}
        </button>
      )}
      {aiText && (
        <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {aiText}
        </div>
      )}
    </div>
  );
}

function buildAiPrompt(ins: Insight | null, avg: ReelAverage | null, mediaComments?: number | null): string {
  const views = ins?.views;
  const reach = ins?.reach;
  const likes = ins?.likes;
  const saved = ins?.saved;
  const shares = ins?.shares;
  const comments = ins?.comments ?? mediaComments;
  const follows = ins?.follows;
  const profileVisits = ins?.profile_visits;
  const avgWatch = ins?.ig_reels_avg_watch_time;

  return `
あなたはInstagramリール動画のマーケティングアナリストです。以下のデータをもとに分析してください。

## このリールの数値
- 閲覧数: ${views ?? '未取得'}
- リーチ: ${reach ?? '未取得'}
- いいね: ${likes ?? '未取得'}
- コメント: ${comments ?? '未取得'}
- 保存: ${saved ?? '未取得'}
- シェア: ${shares ?? '未取得'}
- フォロー: ${follows ?? '未取得'}
- プロフィールアクセス: ${profileVisits ?? '未取得'}
- 平均再生時間(ms): ${avgWatch ?? '未取得'}
- いいね率: ${fmtPct(pct(likes, views))}
- 保存率: ${fmtPct(pct(saved, views))}
- シェア率: ${fmtPct(pct(shares, views))}

## 過去リール平均
- 閲覧数平均: ${avg?.views ?? '未取得'}
- リーチ平均: ${avg?.reach ?? '未取得'}
- 平均再生時間(ms)平均: ${avg?.ig_reels_avg_watch_time ?? '未取得'}

## 以下の点を日本語で分析してください（各200字程度）
1. このリールの良かった点
2. 伸びが止まったと考えられるタイミングと理由
3. 反応率（いいね・コメント）が低い/高い理由
4. 平均再生時間から見た改善点（短い場合は冒頭3秒の改善案）
5. 保存・シェアされやすい要素の分析
6. 次回リール冒頭3秒の改善案
7. 次回投稿で試すべき時間帯・内容の提案
`;
}

// ── メインページ ──────────────────────────────────────────

function ReelInsightsContent() {
  const searchParams = useSearchParams();
  const mediaId = searchParams.get('id');

  const [media, setMedia] = useState<Media | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [avg, setAvg] = useState<ReelAverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!mediaId) { setError('media_id が指定されていません'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/instagram/reel-insights?media_id=${mediaId}`);
      if (!res.ok) { setError('データ取得に失敗しました'); return; }
      const data = await res.json() as { media: Media; insights: Insight[]; reel_average: ReelAverage };
      setMedia(data.media);
      setInsights(data.insights ?? []);
      setAvg(data.reel_average);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!media) return <div className="p-8 text-center text-gray-500">データが見つかりません</div>;

  const latest = insights[insights.length - 1] ?? null;
  const displayedComments = latest?.comments ?? media.comments_count ?? null;

  // 率を計算
  const likeRate = pct(latest?.likes, latest?.views);
  const commentRate = pct(displayedComments, latest?.views);
  const saveRate = pct(latest?.saved, latest?.views);
  const shareRate = pct(latest?.shares, latest?.views);
  const engRate = pct(latest?.total_interactions, latest?.reach);
  const followRate = pct(latest?.follows, latest?.reach);
  const profileRate = pct(latest?.profile_visits, latest?.reach);
  const avgWatchSec = latest?.ig_reels_avg_watch_time != null
    ? Math.round(latest.ig_reels_avg_watch_time / 1000) : null;

  // 推移グラフデータ
  const trendData = insights.map((ins) => ({
    date: new Date(ins.captured_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
    views: ins.views ?? 0,
    reach: ins.reach ?? 0,
    likeRate: +(pct(ins.likes, ins.views) ?? 0).toFixed(2),
    saveRate: +(pct(ins.saved, ins.views) ?? 0).toFixed(2),
    shareRate: +(pct(ins.shares, ins.views) ?? 0).toFixed(2),
    commentRate: +(pct(ins.comments, ins.views) ?? 0).toFixed(2),
    avgWatch: ins.ig_reels_avg_watch_time != null ? Math.round(ins.ig_reels_avg_watch_time / 1000) : 0,
  }));

  // レーダーチャート比較
  const radarData = [
    { metric: '閲覧数', this: latest?.views ?? 0, avg: avg?.views ?? 0 },
    { metric: 'リーチ', this: latest?.reach ?? 0, avg: avg?.reach ?? 0 },
    { metric: 'いいね', this: latest?.likes ?? 0, avg: avg?.likes ?? 0 },
    { metric: '保存', this: latest?.saved ?? 0, avg: avg?.saved ?? 0 },
    { metric: 'シェア', this: latest?.shares ?? 0, avg: avg?.shares ?? 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-start gap-4">
        {media.thumbnail_url && (
          <img src={media.thumbnail_url} alt="thumbnail" className="w-24 h-24 rounded-xl object-cover" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">🎬 リール詳細分析</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(media.timestamp).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{media.caption ?? '（キャプションなし）'}</p>
          <a href={media.permalink} target="_blank" rel="noreferrer"
            className="text-xs text-pink-500 underline mt-1 inline-block">
            Instagramで開く
          </a>
        </div>
      </div>

      {/* 基本指標 */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3">📊 基本指標</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="閲覧数" value={fmt(latest?.views)} />
          <MetricCard label="リーチ" value={fmt(latest?.reach)} />
          <MetricCard label="いいね" value={fmt(latest?.likes)} />
          <MetricCard label="コメント" value={fmt(displayedComments)} />
          <MetricCard label="保存数" value={fmt(latest?.saved)} highlight />
          <MetricCard label="シェア数" value={fmt(latest?.shares)} highlight />
          <MetricCard label="合計インタラクション" value={fmt(latest?.total_interactions)} />
          <MetricCard label="フォロー数" value={fmtApiMetric(latest?.follows)} sub={latest?.follows == null ? "API対象ですが、この投稿では返っていません" : undefined} />
          <MetricCard label="プロフィールアクセス" value={fmtApiMetric(latest?.profile_visits)} sub={latest?.profile_visits == null ? "API対象ですが、この投稿では返っていません" : undefined} />
        </div>
      </section>

      {/* 率の計算 */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3">📈 エンゲージメント率</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="いいね率 (likes/views)" value={fmtPct(likeRate)} />
          <MetricCard label="コメント率 (comments/views)" value={fmtPct(commentRate)} />
          <MetricCard label="保存率 (saved/views)" value={fmtPct(saveRate)} highlight />
          <MetricCard label="シェア率 (shares/views)" value={fmtPct(shareRate)} highlight />
          <MetricCard label="エンゲージメント率 (total/reach)" value={fmtPct(engRate)} />
          <MetricCard label="フォロー転換率 (follows/reach)" value={fmtApiPct(followRate)} sub={followRate == null ? "元データがAPI未返却です" : undefined} />
          <MetricCard label="プロフィールアクセス率" value={fmtApiPct(profileRate)} sub={profileRate == null ? "元データがAPI未返却です" : undefined} />
        </div>
      </section>

      {/* 再生時間分析 */}
      <section>
        <h2 className="font-bold text-gray-700 mb-3">⏱ 再生時間分析</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard
            label="平均再生時間"
            value={fmtApiSec(latest?.ig_reels_avg_watch_time)}
          />
          <MetricCard
            label="総再生時間"
            value={fmtApiSec(latest?.ig_reels_video_view_total_time)}
          />
          <MetricCard label="動画の長さ" value="API対象外" sub="Instagram APIでは返りません" />
          <MetricCard label="平均視聴維持率" value="API対象外" sub="動画長が返らないため計算不可" />
        </div>
        <div className="mt-3 p-4 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-1">
          <p className="font-bold">📌 表示の見方</p>
          <p>• API未返却 — 取得対象ですが、この投稿ではAPIが値を返していません</p>
          <p>• API対象外 — Instagram APIの仕様上取得できません</p>
          <p>• スキップ率 — API対象外</p>
          <p>• 再投稿率 — API対象外</p>
          <p>• 秒ごとの視聴維持率グラフ — API対象外</p>
          <p>• 閲覧数の上位ソース（リールタブ/発見タブ） — API対象外</p>
        </div>
      </section>

      {/* 近似分析 */}
      {latest && (
        <section>
          <h2 className="font-bold text-gray-700 mb-3">🔍 近似分析</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-sm text-blue-800">
            {avgWatchSec != null && avgWatchSec < 5 && (
              <p>⚠️ 平均再生時間が{avgWatchSec}秒と非常に短いため、冒頭3秒以内で離脱している可能性があります。</p>
            )}
            {saveRate != null && saveRate > 5 && (
              <p>✅ 保存率{saveRate.toFixed(1)}%は高水準です。後で見返したい・有益な内容として認識されています。</p>
            )}
            {shareRate != null && shareRate > 2 && (
              <p>✅ シェア率{shareRate.toFixed(1)}%が高く、人に共有したいコンテンツとして評価されています。</p>
            )}
            {likeRate != null && likeRate < 1 && (latest?.views ?? 0) > 500 && (
              <p>⚠️ いいね率{likeRate.toFixed(2)}%が低めです。見られているが反応されにくい内容かもしれません。</p>
            )}
            {latest?.reach != null && latest.reach > 1000 && (latest?.follows ?? 0) < 10 && (
              <p>⚠️ リーチ{fmt(latest.reach)}に対しフォロー{fmt(latest.follows)}が少ないです。プロフィール誘導や継続性の改善を検討してください。</p>
            )}
            {!avgWatchSec && !saveRate && !shareRate && !likeRate && (
              <p>インサイトデータが不足しているため近似分析を表示できません。</p>
            )}
          </div>
        </section>
      )}

      {/* 推移グラフ */}
      {trendData.length > 1 && (
        <section>
          <h2 className="font-bold text-gray-700 mb-3">📉 推移グラフ</h2>
          <div className="space-y-6">
            {/* 閲覧数・リーチ */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-600 mb-3">閲覧数 / リーチ推移</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="views" name="閲覧数" stroke="#ec4899" dot={false} />
                  <Line type="monotone" dataKey="reach" name="リーチ" stroke="#6366f1" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 率の推移 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-600 mb-3">いいね率 / 保存率 / シェア率推移 (%)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="likeRate" name="いいね率" stroke="#f59e0b" dot={false} />
                  <Line type="monotone" dataKey="saveRate" name="保存率" stroke="#10b981" dot={false} />
                  <Line type="monotone" dataKey="shareRate" name="シェア率" stroke="#3b82f6" dot={false} />
                  <Line type="monotone" dataKey="commentRate" name="コメント率" stroke="#8b5cf6" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 平均再生時間推移 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-600 mb-3">平均再生時間推移 (秒)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgWatch" name="平均再生時間(秒)" stroke="#ec4899" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* 比較 */}
      {avg && (
        <section>
          <h2 className="font-bold text-gray-700 mb-3">⚖️ 過去リール平均との比較</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <CompareBar label="閲覧数" value={latest?.views} avg={avg.views} />
            <CompareBar label="リーチ" value={latest?.reach} avg={avg.reach} />
            <CompareBar label="いいね" value={latest?.likes} avg={avg.likes} />
            <CompareBar label="保存数" value={latest?.saved} avg={avg.saved} />
            <CompareBar label="シェア数" value={latest?.shares} avg={avg.shares} />
            <CompareBar label="フォロー数" value={latest?.follows} avg={avg.follows} />
            <CompareBar label="平均再生時間(ms)" value={latest?.ig_reels_avg_watch_time} avg={avg.ig_reels_avg_watch_time} />
            <p className="text-xs text-gray-400 mt-3">ピンク=このリール / グレー=過去リール平均</p>

            {/* レーダーチャート */}
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <Radar name="このリール" dataKey="this" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} />
                  <Radar name="平均" dataKey="avg" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.2} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* AI分析 */}
      <AiAnalysis latest={latest} avg={avg} mediaComments={media.comments_count} />
    </div>
  );
}

export default function ReelInsightsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">読み込み中...</div>}>
      <ReelInsightsContent />
    </Suspense>
  );
}
