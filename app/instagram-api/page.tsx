'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Media {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  latest_insights?: {
    views?: number | null;
    reach?: number | null;
    likes?: number | null;
    comments?: number | null;
    saved?: number | null;
    shares?: number | null;
    total_interactions?: number | null;
    follows?: number | null;
    ig_reels_avg_watch_time?: number | null;
  } | null;
}

type SortKey = 'timestamp' | 'views' | 'reach' | 'saved' | 'likes';

const fmt = (v: number | null | undefined) =>
  v == null ? '–' : v.toLocaleString('ja-JP');

const pctFmt = (num: number | null | undefined, den: number | null | undefined) => {
  if (num == null || den == null || den === 0) return '–';
  return `${((num / den) * 100).toFixed(1)}%`;
};

function MediaTypeBadge({ type }: { type: string }) {
  const color = type === 'VIDEO' ? 'bg-pink-100 text-pink-600'
    : type === 'CAROUSEL_ALBUM' ? 'bg-blue-100 text-blue-600'
    : 'bg-gray-100 text-gray-600';
  const label = type === 'VIDEO' ? '🎬 リール/動画' : type === 'CAROUSEL_ALBUM' ? '🖼 カルーセル' : '📷 画像';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

export default function IgMediaListPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let url = '/api/instagram/media?limit=100';
    if (typeFilter) url += `&media_type=${typeFilter}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setMedia((d as { data: Media[] }).data ?? []))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  const sorted = [...media].sort((a, b) => {
    if (sortKey === 'timestamp') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    const av = a.latest_insights?.[sortKey === 'saved' ? 'saved' : sortKey] ?? 0;
    const bv = b.latest_insights?.[sortKey === 'saved' ? 'saved' : sortKey] ?? 0;
    return (bv as number) - (av as number);
  });

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📋 投稿一覧（Graph APIデータ）</h1>
        <div className="flex gap-2">
          {/* タイプフィルタ */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="">すべて</option>
            <option value="VIDEO">リール/動画</option>
            <option value="IMAGE">画像</option>
            <option value="CAROUSEL_ALBUM">カルーセル</option>
          </select>
          {/* ソート */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="timestamp">投稿日順</option>
            <option value="views">閲覧数順</option>
            <option value="reach">リーチ順</option>
            <option value="saved">保存数順</option>
            <option value="likes">いいね順</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">{sorted.length} 件</p>

      <div className="space-y-3">
        {sorted.map(m => {
          const ins = m.latest_insights;
          const isVideo = m.media_type === 'VIDEO';
          return (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow transition">
              <div className="flex gap-4">
                {/* サムネイル */}
                <div className="flex-shrink-0">
                  {(m.thumbnail_url ?? m.media_url) ? (
                    <Image
                      src={m.thumbnail_url ?? m.media_url ?? ""}
                      alt=""
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MediaTypeBadge type={m.media_type} />
                    <span className="text-xs text-gray-400">
                      {new Date(m.timestamp).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                    {m.caption ?? '（キャプションなし）'}
                  </p>

                  {/* インサイト数値 */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                    {isVideo && (
                      <div className="text-center">
                        <p className="text-gray-400">閲覧数</p>
                        <p className="font-bold text-pink-600">{fmt(ins?.views)}</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-gray-400">リーチ</p>
                      <p className="font-bold">{fmt(ins?.reach)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">いいね</p>
                      <p className="font-bold">{fmt(ins?.likes)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">保存</p>
                      <p className="font-bold text-green-600">{fmt(ins?.saved)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">保存率</p>
                      <p className="font-bold">{pctFmt(ins?.saved, ins?.views ?? ins?.reach)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">シェア</p>
                      <p className="font-bold">{fmt(ins?.shares)}</p>
                    </div>
                    {isVideo && (
                      <div className="text-center">
                        <p className="text-gray-400">平均再生時間</p>
                        <p className="font-bold">
                          {ins?.ig_reels_avg_watch_time != null
                            ? `${Math.round(ins.ig_reels_avg_watch_time / 1000)}秒`
                            : '–'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* アクション */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <a href={m.permalink} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                    開く
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p>投稿データがありません。</p>
            <p className="text-sm mt-1">ダッシュボードの「Instagramデータ同期」ボタンでデータを取得してください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
