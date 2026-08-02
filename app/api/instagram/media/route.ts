/**
 * GET /api/instagram/media
 * Supabaseから投稿一覧と最新インサイトを返す
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getAuthenticatedUser } from '@/lib/authenticated-user';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const mediaType = searchParams.get('media_type'); // IMAGE / VIDEO / CAROUSEL_ALBUM
  const rawLimit = parseInt(searchParams.get('pageSize') ?? searchParams.get('limit') ?? '50');
  const rawPage = parseInt(searchParams.get('page') ?? '1');
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;

  const db = getSupabaseServerClient();
  const ownerId = getAuthenticatedUser(req);
  if (!db) {
    return NextResponse.json({
      configured: false,
      data: [],
      message: 'Instagramデータベースが未接続です。',
    });
  }
  let allowedAccountIds: string[] | null = null;
  if (process.env.USER_DATA_OWNERSHIP_ENABLED === "true") {
    const { data: ownedAccounts } = await db.from('instagram_accounts').select('id').eq('owner_id', ownerId);
    allowedAccountIds = (ownedAccounts ?? []).map((account) => String(account.id));
    if (accountId && !allowedAccountIds.includes(accountId)) {
      return NextResponse.json({ configured: true, data: [] });
    }
    if (!accountId && allowedAccountIds.length === 0) {
      return NextResponse.json({ configured: true, data: [] });
    }
  }
  let countQuery = db.from('instagram_media').select('id', { count: 'exact', head: true });
  if (accountId) countQuery = countQuery.eq('account_id', accountId);
  else if (allowedAccountIds) countQuery = countQuery.in('account_id', allowedAccountIds);
  if (mediaType) countQuery = countQuery.eq('media_type', mediaType);
  const { count } = await countQuery;

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
    .range((page - 1) * limit, page * limit - 1);

  if (accountId) query = query.eq('account_id', accountId);
  else if (allowedAccountIds) query = query.in('account_id', allowedAccountIds);
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

  return NextResponse.json({ configured: true, data: result, page, pageSize: limit, total: count ?? result.length });
}
