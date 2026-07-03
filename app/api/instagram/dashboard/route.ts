/**
 * GET /api/instagram/dashboard?account_id=xxx
 * ダッシュボード用の集計データを返す
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const db = supabase();

  // アカウント情報
  let accountQuery = db
    .from('instagram_accounts')
    .select('*')
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1);
  if (accountId) accountQuery = accountQuery.eq('id', accountId);
  const { data: accounts } = await accountQuery;
  const account = accounts?.[0] ?? null;
  const activeAccountId = accountId ?? account?.id ?? null;

  // 投稿 + 最新インサイト
  let mediaQuery = db
    .from('instagram_media')
    .select(`
      id, caption, media_type, permalink, thumbnail_url, timestamp, like_count, comments_count,
      instagram_media_insights (
        impressions, reach, likes, comments, saved, shares,
        total_interactions, follows, profile_visits, views,
        ig_reels_avg_watch_time, captured_at
      )
    `)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (activeAccountId) mediaQuery = mediaQuery.eq('account_id', activeAccountId);
  const { data: mediaRaw } = await mediaQuery;

  // 各投稿に最新インサイトだけ残す
  const media = (mediaRaw ?? []).map((m) => {
    const ins = (m.instagram_media_insights as unknown[]) ?? [];
    const latest = [...ins].sort((a, b) =>
      new Date((b as { captured_at: string }).captured_at).getTime() -
      new Date((a as { captured_at: string }).captured_at).getTime()
    )[0] as Record<string, number> | null;
    return { ...m, ins: latest, instagram_media_insights: undefined };
  });

  // 集計
  const totals = {
    posts: media.length,
    reach: sum(media, 'reach'),
    impressions: sum(media, 'impressions'),
    likes: sum(media, 'likes'),
    comments: sum(media, 'comments'),
    saved: sum(media, 'saved'),
    shares: sum(media, 'shares'),
    views: sum(media, 'views'),
  };

  // エンゲージメント率（リーチが0の投稿を除く）
  const engRates = media
    .filter(m => (m.ins?.reach ?? 0) > 0)
    .map(m => ((m.ins?.total_interactions ?? 0) / (m.ins?.reach ?? 1)) * 100);
  const avgEngRate = engRates.length
    ? engRates.reduce((a, b) => a + b, 0) / engRates.length
    : 0;

  // 投稿ランキング（views順）
  const byViews = [...media]
    .sort((a, b) => (b.ins?.views ?? 0) - (a.ins?.views ?? 0))
    .slice(0, 10);

  // 保存率ランキング
  const bySaveRate = [...media]
    .filter(m => (m.ins?.views ?? 0) > 0)
    .map(m => ({ ...m, save_rate: ((m.ins?.saved ?? 0) / (m.ins?.views ?? 1)) * 100 }))
    .sort((a, b) => b.save_rate - a.save_rate)
    .slice(0, 10);

  // 曜日別集計
  const byDow: Record<number, { count: number; reach: number; likes: number }> = {};
  for (const m of media) {
    const dow = new Date(m.timestamp as string).getDay();
    if (!byDow[dow]) byDow[dow] = { count: 0, reach: 0, likes: 0 };
    byDow[dow].count++;
    byDow[dow].reach += m.ins?.reach ?? 0;
    byDow[dow].likes += m.ins?.likes ?? 0;
  }

  // 時間帯別集計
  const byHour: Record<number, { count: number; reach: number }> = {};
  for (const m of media) {
    const h = new Date(m.timestamp as string).getHours();
    if (!byHour[h]) byHour[h] = { count: 0, reach: 0 };
    byHour[h].count++;
    byHour[h].reach += m.ins?.reach ?? 0;
  }

  // 投稿タイプ別
  const byType: Record<string, { count: number; avg_reach: number; avg_views: number }> = {};
  for (const m of media) {
    const t = m.media_type as string;
    if (!byType[t]) byType[t] = { count: 0, avg_reach: 0, avg_views: 0 };
    byType[t].count++;
    byType[t].avg_reach += m.ins?.reach ?? 0;
    byType[t].avg_views += m.ins?.views ?? 0;
  }
  for (const t of Object.keys(byType)) {
    byType[t].avg_reach = byType[t].count > 0 ? Math.round(byType[t].avg_reach / byType[t].count) : 0;
    byType[t].avg_views = byType[t].count > 0 ? Math.round(byType[t].avg_views / byType[t].count) : 0;
  }

  // フォロワー推移（デイリースナップショット）
  let snapQuery = db
    .from('instagram_daily_snapshots')
    .select('date, followers_count')
    .order('date', { ascending: true })
    .limit(90);
  if (activeAccountId) snapQuery = snapQuery.eq('account_id', activeAccountId);
  const { data: snapshots } = await snapQuery;

  // アカウントインサイト推移
  let aiQuery = db
    .from('instagram_account_insights')
    .select('date, reach, impressions, profile_views, website_clicks, follower_count')
    .order('date', { ascending: false })
    .limit(90);
  if (activeAccountId) aiQuery = aiQuery.eq('account_id', activeAccountId);
  const { data: accountInsightsRaw } = await aiQuery;
  const accountInsights = [...(accountInsightsRaw ?? [])].reverse();

  return NextResponse.json({
    account,
    totals,
    avg_engagement_rate: avgEngRate,
    top_by_views: byViews,
    top_by_save_rate: bySaveRate,
    by_day_of_week: byDow,
    by_hour: byHour,
    by_media_type: byType,
    follower_snapshots: snapshots ?? [],
    account_insights_trend: accountInsights ?? [],
  });
}

function sum(arr: { ins?: Record<string, number> | null }[], key: string): number {
  return arr.reduce((acc, m) => acc + (m.ins?.[key] ?? 0), 0);
}
