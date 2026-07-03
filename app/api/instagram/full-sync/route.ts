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
import type { InstagramSyncRun } from '@/lib/types';

export const maxDuration = 180;

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 環境変数が未設定です');
  return createClient(url, key);
}

type ExistingAccountRow = {
  id: string;
};

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return { ok: false, status: 500, message: 'CRON_SECRETが設定されていません。' };
  }
  const bearer = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  const providedSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : cronHeader;
  if (providedSecret !== cronSecret) {
    return { ok: false, status: 401, message: 'CRON_SECRETが一致しません。' };
  }
  return { ok: true as const };
}

type SyncTriggerType = "manual" | "scheduled";

async function saveScheduledSyncRun(run: Omit<InstagramSyncRun, "id">) {
  const db = supabase();
  const { error } = await db.from('instagram_sync_runs').insert({
    trigger_type: run.triggerType,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    fetched_posts: run.fetchedPosts,
    saved_posts: run.savedPosts,
    saved_snapshots: run.savedSnapshots,
    failed_posts: run.failedPosts,
    api_mode: run.apiMode,
    account_id: run.accountId ?? null,
    account_name: run.accountName ?? null,
    account_username: run.accountUsername ?? null,
    error_summary: run.errorSummary ?? null,
    errors: run.errors,
  });
  if (error) {
    throw new Error(`[full-sync-run-save] ${error.message}`);
  }
}

async function safeSaveScheduledSyncRun(run: Omit<InstagramSyncRun, "id">) {
  try {
    await saveScheduledSyncRun(run);
  } catch (error) {
    console.error('[full-sync-run-save]', error);
  }
}

export async function POST(request: Request) {
  const isScheduled = Boolean(request.headers.get('x-cron-secret') || request.headers.get('authorization'));
  if (isScheduled) {
    const auth = isAuthorizedCronRequest(request);
    if (!auth.ok) {
      const now = new Date().toISOString();
      await safeSaveScheduledSyncRun({
        triggerType: "scheduled",
        status: "failed",
        startedAt: now,
        finishedAt: now,
        fetchedPosts: 0,
        savedPosts: 0,
        savedSnapshots: 0,
        failedPosts: 0,
        apiMode: "full-sync",
        errorSummary: auth.message,
        errors: [{ stage: "auth", message: auth.message }],
      });
      return NextResponse.json({ ok: false, error: auth.message, type: 'unauthorized' }, { status: auth.status });
    }
  }
  return handler(isScheduled ? "scheduled" : "manual");
}
export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    const now = new Date().toISOString();
    await safeSaveScheduledSyncRun({
      triggerType: "scheduled",
      status: "failed",
      startedAt: now,
      finishedAt: now,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: "full-sync",
      errorSummary: auth.message,
      errors: [{ stage: "auth", message: auth.message }],
    });
    return NextResponse.json({ ok: false, error: auth.message, type: 'unauthorized' }, { status: auth.status });
  }
  return handler("scheduled");
}

async function handler(triggerType: SyncTriggerType) {
  const db = supabase();
  const startedAt = new Date().toISOString();
  const results = {
    account: null as unknown,
    media_fetched: 0,
    media_saved: 0,
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
      if (triggerType === "scheduled") {
        await safeSaveScheduledSyncRun({
          triggerType,
          status: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          fetchedPosts: 0,
          savedPosts: 0,
          savedSnapshots: 0,
          failedPosts: 0,
          apiMode: "full-sync",
          errorSummary: `アカウント保存エラー: ${accErr.message}`,
          errors: [{ stage: "account", message: `アカウント保存エラー: ${accErr.message}` }],
        });
      }
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
          media_product_type: media.media_product_type ?? null,
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
      } else {
        results.media_saved++;
      }

      // インサイト保存（fetchMediaList でフィールド展開済み）
      try {
        const ins = media.insights ?? null;
        const detailedInsights = await fetchMediaInsights(media.id, media.media_type, media.media_product_type);
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
      const targetDate = accInsights.date ?? new Date().toISOString().slice(0, 10);
      const { error: aiErr } = await db
        .from('instagram_account_insights')
        .upsert({
          account_id: accountId,
          date: targetDate,
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
      results.errors.push(e instanceof Error ? `アカウントインサイトエラー: ${e.message}` : 'アカウントインサイトエラーが発生しました。');
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

    const finishedAt = new Date().toISOString();
    const fullSyncStatus =
      results.errors.length === 0
        ? "success"
        : results.media_saved > 0 || results.insights_fetched > 0 || results.snapshot_saved || results.account_insights === 'ok'
          ? "partial"
          : "failed";

    await safeSaveScheduledSyncRun({
      triggerType,
      status: fullSyncStatus,
      startedAt,
      finishedAt,
      fetchedPosts: results.media_fetched,
      savedPosts: results.media_saved,
      savedSnapshots: results.insights_fetched,
      failedPosts: results.insights_failed,
      apiMode: "full-sync",
      accountId,
      accountName: account.name,
      accountUsername: normalizedUsername ?? undefined,
      errorSummary: results.errors[0] ?? undefined,
      errors: results.errors.map((message, index) => ({
        stage: index === 0 && results.account_insights === 'failed' ? "account_insights" : "full_sync",
        message,
      })),
    });

    return NextResponse.json(
      { ok: fullSyncStatus === "success", status: fullSyncStatus, ...results },
      { status: fullSyncStatus === "failed" ? 500 : fullSyncStatus === "partial" ? 207 : 200 }
    );

  } catch (e) {
    const err = e as ApiError;
    const errMeta = err as ApiError & { code?: number; subcode?: number; trace_id?: string };
    const status = err.type === 'token_expired' ? 401 : err.type === 'permission_denied' ? 403 : 500;
    if (triggerType === "scheduled") {
      await safeSaveScheduledSyncRun({
        triggerType,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        fetchedPosts: results.media_fetched,
        savedPosts: 0,
        savedSnapshots: results.snapshot_saved ? 1 : 0,
        failedPosts: results.insights_failed,
        apiMode: "full-sync",
        errorSummary: err.message ?? String(e),
        errors: [{
          stage: err.type ?? 'unknown',
          message: err.message ?? String(e),
          code: errMeta.code,
          subcode: errMeta.subcode,
          traceId: errMeta.trace_id,
        }],
      });
    }
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
