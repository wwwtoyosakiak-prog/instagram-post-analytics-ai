/**
 * GET /api/instagram/reel-insights?media_id=xxx
 * リール単体の全インサイット履歴 + 平均比較用データを返す
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchMediaInsights } from '@/lib/instagram-graph-api';

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get('media_id');
  if (!mediaId) return NextResponse.json({ error: 'media_id が必要です' }, { status: 400 });

  const db = supabase();

  // 対象リールの情報
  const { data: media, error: mediaErr } = await db
    .from('instagram_media')
    .select('*')
    .eq('id', mediaId)
    .single();

  if (mediaErr) return NextResponse.json({ error: mediaErr.message }, { status: 404 });

  // インサイト履歴（時系列）
  const { data: insights } = await db
    .from('instagram_media_insights')
    .select('*')
    .eq('media_id', mediaId)
    .order('captured_at', { ascending: true });

  const mediaRow = media as {
    id: string;
    media_type: string;
    account_id: string;
    comments_count?: number | null;
  };

  const currentInsights = (insights ?? []) as Array<InsightRow & { captured_at: string }>;
  const latest = currentInsights[currentInsights.length - 1] ?? null;
  const needsLiveFetch =
    mediaRow.media_type === 'VIDEO' &&
    (
      !latest ||
      latest.follows == null ||
      latest.profile_visits == null ||
      latest.ig_reels_video_view_total_time == null ||
      latest.comments == null
    );

  let mergedInsights = currentInsights;

  if (needsLiveFetch) {
    const live = await fetchMediaInsights(mediaId, mediaRow.media_type);
    const hasLiveMetrics =
      live.views != null ||
      live.reach != null ||
      live.likes != null ||
      live.comments != null ||
      live.saved != null ||
      live.shares != null ||
      live.total_interactions != null ||
      live.follows != null ||
      live.profile_visits != null ||
      live.ig_reels_avg_watch_time != null ||
      live.ig_reels_video_view_total_time != null;

    if (hasLiveMetrics) {
      const capturedAt = new Date().toISOString();
      const mergedLatest = {
        views: live.views ?? latest?.views ?? null,
        reach: live.reach ?? latest?.reach ?? null,
        likes: live.likes ?? latest?.likes ?? null,
        comments: live.comments ?? latest?.comments ?? mediaRow.comments_count ?? null,
        saved: live.saved ?? latest?.saved ?? null,
        shares: live.shares ?? latest?.shares ?? null,
        total_interactions: live.total_interactions ?? latest?.total_interactions ?? null,
        follows: live.follows ?? latest?.follows ?? null,
        profile_visits: live.profile_visits ?? latest?.profile_visits ?? null,
        ig_reels_avg_watch_time: live.ig_reels_avg_watch_time ?? latest?.ig_reels_avg_watch_time ?? null,
        ig_reels_video_view_total_time: live.ig_reels_video_view_total_time ?? latest?.ig_reels_video_view_total_time ?? null,
      };

      await db
        .from('instagram_media_insights')
        .insert({
          media_id: mediaId,
          account_id: mediaRow.account_id,
          captured_at: capturedAt,
          ...mergedLatest,
          raw_response: live.raw_response ?? null,
        });

      mergedInsights = [...currentInsights, { captured_at: capturedAt, ...mergedLatest }];
    }
  }

  // 同アカウントの過去リール平均（比較用）
  const { data: allReelInsights } = await db
    .from('instagram_media_insights')
    .select('views, reach, likes, comments, saved, shares, total_interactions, follows, profile_visits, ig_reels_avg_watch_time')
    .eq('account_id', mediaRow.account_id)
    .neq('media_id', mediaId)
    .not('views', 'is', null)
    .order('captured_at', { ascending: false })
    .limit(200);

  // 過去リール平均を計算
  const avg = calcAverage(allReelInsights ?? []);

  return NextResponse.json({
    media,
    insights: mergedInsights,
    reel_average: avg,
  });
}

type InsightRow = {
  captured_at?: string;
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
};

function calcAverage(rows: InsightRow[]) {
  if (!rows.length) return null;
  const keys: (keyof InsightRow)[] = [
    'views', 'reach', 'likes', 'comments', 'saved', 'shares',
    'total_interactions', 'follows', 'profile_visits', 'ig_reels_avg_watch_time',
  ];
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const key of keys) { sums[key] = 0; counts[key] = 0; }
  for (const row of rows) {
    for (const key of keys) {
      const v = row[key];
      if (v != null) { sums[key] += Number(v); counts[key]++; }
    }
  }
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    result[key] = counts[key] > 0 ? Math.round(sums[key] / counts[key]) : null;
  }
  return result;
}
