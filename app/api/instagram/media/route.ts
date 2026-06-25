/**
 * GET /api/instagram/media
 * Supabaseから投稿一覧と最新インサイトを返す
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const mediaType = searchParams.get('media_type'); // IMAGE / VIDEO / CAROUSEL_ALBUM
  const limit = parseInt(searchParams.get('limit') ?? '50');

  const db = supabase();
  let query = db
    .from('instagram_media')
    .select(`
      *,
      instagram_media_insights (
        impressions, reach, likes, comments, saved, shares,
        total_interactions, follows, profile_visits,
        views, plays, ig_reels_avg_watch_time,
        ig_reels_video_view_total_time, captured_at
      )
    `)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (accountId) query = query.eq('account_id', accountId);
  if (mediaType) query = query.eq('media_type', mediaType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 各投稿に最新インサイトだけ残す
  const result = (data ?? []).map((m) => {
    const insights = (m.instagram_media_insights as unknown[]) ?? [];
    const latest = [...insights].sort((a, b) =>
      new Date((b as { captured_at: string }).captured_at).getTime() -
      new Date((a as { captured_at: string }).captured_at).getTime()
    )[0] ?? null;
    return { ...m, latest_insights: latest, instagram_media_insights: undefined };
  });

  return NextResponse.json({ data: result });
}
