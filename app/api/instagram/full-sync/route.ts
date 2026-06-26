/**
 * POST/GET /api/instagram/full-sync
 * Instagram Graph API からデータを全取得してSupabaseに保存する
 */
import { NextResponse } from 'next/server';
import {
  fetchAccountInfo,
  fetchMediaInsights,
  fetchMediaList,
  fetchAccountInsights,
  fetchFollowerSnapshot,
  getMetric,
  isReel,
  type ApiError,
} from '@/lib/instagram-graph-api';
import { createClient } from '@supabase/supabase-js';

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 環境変数が未設定です');
  return createClient(url, key);
}

type ExistingAccountRow = {
  id: string;
};

export async function POST() {
  return handler();
}
export async function GET() {
  return handler();
}

async function handler() {
  const db = supabase();
  const results = {
    account: null as unknown,
    media_fetched: 0,
    insights_fetched: 0,
    insights_failed: 0,
    account_insights: null as unknown,
    snapshot_saved: false,
    errors: [] as string[],
  };

  try {
    // 1. アカウント情報取得
    const account = await fetchAccountInfo();
    console.log('[full-sync] account:', account.username ?? '(username unavailable)', account.id);
    results.account = { username: account.username ?? null, id: account.id };

    const syncedAt = new Date().toISOString();
    const normalizedUsername = account.username?.replace(/^@/, '').trim() ?? null;

    // 既存の手動登録アカウントを優先的に再利用して、同期先が増殖しないようにする。
    let existingAccount: ExistingAccountRow | null = null;
    const { data: linkedAccount } = await db
      .from('instagram_accounts')
      .select('id')
      .eq('ig_user_id', account.id)
      .limit(1)
      .maybeSingle<ExistingAccountRow>();
    existingAccount = linkedAccount ?? null;

    if (!existingAccount && normalizedUsername) {
      const { data: apiUsernameLinked } = await db
        .from('instagram_accounts')
        .select('id')
        .eq('instagram_api_username', normalizedUsername)
        .limit(1)
        .maybeSingle<ExistingAccountRow>();
      existingAccount = apiUsernameLinked ?? null;
    }

    if (!existingAccount && normalizedUsername) {
      const { data: usernameLinked } = await db
        .from('instagram_accounts')
        .select('id')
        .eq('username', normalizedUsername)
        .limit(1)
        .maybeSingle<ExistingAccountRow>();
      existingAccount = usernameLinked ?? null;
    }

    const accountPayload = {
      ig_user_id: account.id,
      username: normalizedUsername,
      instagram_api_username: normalizedUsername,
      name: account.name,
      biography: account.biography,
      profile_picture_url: account.profile_picture_url,
      followers_count: account.followers_count,
      follows_count: account.follows_count,
      media_count: account.media_count,
      website: account.website,
      last_synced_at: syncedAt,
    };

    let accountRow: ExistingAccountRow | null = null;
    let accErr: { message: string } | null = null;

    if (existingAccount) {
      const { data, error } = await db
        .from('instagram_accounts')
        .update(accountPayload)
        .eq('id', existingAccount.id)
        .select('id')
        .single<ExistingAccountRow>();
      accountRow = data ?? null;
      accErr = error;
    } else {
      const { data, error } = await db
        .from('instagram_accounts')
        .insert(accountPayload)
        .select('id')
        .single<ExistingAccountRow>();
      accountRow = data ?? null;
      accErr = error;
    }

    if (accErr) {
      console.error('[full-sync] account upsert error:', accErr);
      results.errors.push(`アカウント保存エラー: ${accErr.message}`);
      return NextResponse.json({ ok: false, ...results }, { status: 500 });
    }

    const accountId = (accountRow as { id: string }).id;

    // 2. 投稿一覧取得
    const mediaList = await fetchMediaList(account.id);
    results.media_fetched = mediaList.length;
    console.log(`[full-sync] media: ${mediaList.length} 件`);

    // 3. 各投稿を保存 + インサイト取得
    for (const media of mediaList) {
      // 投稿保存
      const { error: mediaErr } = await db
        .from('instagram_media')
        .upsert({
          id: media.id,
          account_id: accountId,
          ig_user_id: account.id,
          caption: media.caption ?? null,
          media_type: media.media_type,
          media_url: media.media_url ?? null,
          thumbnail_url: media.thumbnail_url ?? null,
          permalink: media.permalink,
          timestamp: media.timestamp,
          like_count: media.like_count ?? 0,
          comments_count: media.comments_count ?? 0,
          children: media.children ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (mediaErr) {
        console.warn(`[full-sync] media upsert error ${media.id}:`, mediaErr.message);
        results.errors.push(`投稿保存エラー ${media.id}: ${mediaErr.message}`);
      }

      // インサイト保存（fetchMediaList でフィールド展開済み）
      try {
        const ins = media.insights ?? null;
        const detailedInsights = await fetchMediaInsights(media.id, media.media_type);
        const { error: insErr } = await db
          .from('instagram_media_insights')
          .insert({
            media_id: media.id,
            account_id: accountId,
            captured_at: new Date().toISOString(),
            reach: detailedInsights.reach ?? getMetric(ins, 'reach'),
            views: detailedInsights.views ?? getMetric(ins, 'views'),
            likes: detailedInsights.likes ?? getMetric(ins, 'likes'),
            comments: detailedInsights.comments ?? media.comments_count ?? getMetric(ins, 'comments'),
            saved: detailedInsights.saved ?? getMetric(ins, 'saved'),
            shares: detailedInsights.shares ?? getMetric(ins, 'shares'),
            total_interactions: detailedInsights.total_interactions ?? getMetric(ins, 'total_interactions'),
            follows: detailedInsights.follows ?? null,
            profile_visits: detailedInsights.profile_visits ?? null,
            ig_reels_avg_watch_time: detailedInsights.ig_reels_avg_watch_time ?? getMetric(ins, 'ig_reels_avg_watch_time'),
            ig_reels_video_view_total_time: detailedInsights.ig_reels_video_view_total_time ?? null,
            raw_response: detailedInsights.raw_response ?? ins,
          });

        if (insErr) {
          console.warn(`[full-sync] insights insert error ${media.id}:`, insErr.message);
          results.insights_failed++;
        } else {
          results.insights_fetched++;
        }
      } catch (e) {
        results.insights_failed++;
        console.warn(`[full-sync] insights exception ${media.id}:`, e);
      }
    }

    // 4. アカウント全体インサイト取得
    try {
      const accInsights = await fetchAccountInsights(account.id);
      const today = new Date().toISOString().slice(0, 10);
      const { error: aiErr } = await db
        .from('instagram_account_insights')
        .upsert({
          account_id: accountId,
          date: today,
          reach: accInsights.reach ?? null,
          impressions: accInsights.impressions ?? null,
          profile_views: accInsights.profile_views ?? null,
          website_clicks: accInsights.website_clicks ?? null,
          follower_count: accInsights.follower_count ?? null,
          online_followers: accInsights.online_followers ?? null,
          audience_city: accInsights.audience_city ?? null,
          audience_country: accInsights.audience_country ?? null,
          audience_gender_age: accInsights.audience_gender_age ?? null,
          email_contacts: accInsights.email_contacts ?? null,
          get_directions_clicks: accInsights.get_directions_clicks ?? null,
          phone_call_clicks: accInsights.phone_call_clicks ?? null,
          text_message_clicks: accInsights.text_message_clicks ?? null,
        }, { onConflict: 'account_id,date' });

      if (aiErr) {
        console.warn('[full-sync] account insights error:', aiErr.message);
        results.errors.push(`アカウントインサイトエラー: ${aiErr.message}`);
      } else {
        results.account_insights = 'ok';
      }
    } catch (e) {
      console.warn('[full-sync] account insights exception:', e);
      results.account_insights = 'failed';
    }

    // 5. デイリースナップショット（フォロワー推移）
    try {
      const snap = await fetchFollowerSnapshot(account.id);
      const today = new Date().toISOString().slice(0, 10);
      const { error: snapErr } = await db
        .from('instagram_daily_snapshots')
        .upsert({
          account_id: accountId,
          date: today,
          followers_count: snap.followers_count,
          follows_count: snap.follows_count,
          media_count: snap.media_count,
        }, { onConflict: 'account_id,date' });

      results.snapshot_saved = !snapErr;
    } catch (e) {
      console.warn('[full-sync] snapshot exception:', e);
    }

    return NextResponse.json({ ok: true, ...results });

  } catch (e) {
    const err = e as ApiError;
    const status = err.type === 'token_expired' ? 401 : err.type === 'permission_denied' ? 403 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: err.message ?? String(e),
        type: err.type ?? 'unknown',
        // DEBUG: 原因調査用（確認後に削除）
        debug_url: err.debug_url ?? null,
        raw_api_error: err.raw ?? null,
      },
      { status }
    );
  }
}
