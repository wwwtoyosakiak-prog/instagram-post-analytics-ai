/**
 * GET /api/instagram/reel-insights?media_id=xxx
 * リール単体の全インサイット履歴 + 平均比較用データを返す
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // 同アカウントの過去リール平均（比較用）
  const { data: allReelInsights } = await db
    .from('instagram_media_insights')
    .select('views, reach, likes, comments, saved, shares, total_interactions, follows, profile_visits, ig_reels_avg_watch_time')
    .eq('account_id', (media as { account_id: string }).account_id)
    .neq('media_id', mediaId)
    .not('views', 'is', null)
    .order('captured_at', { ascending: false })
    .limit(200);

  // 過去リール平均を計算
  const avg = calcAverage(allReelInsights ?? []);

  return NextResponse.json({
    media,
    insights: insights ?? [],
    reel_average: avg,
  });
}

type InsightRow = {
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
