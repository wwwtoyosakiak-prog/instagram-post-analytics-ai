import { NextResponse } from "next/server";
import { createInstagramGraphUrl, getInstagramGraphConfig, InstagramGraphConfig } from "@/lib/instagram-graph";
import { InstagramSyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type GraphMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  like_count?: number;
  comments_count?: number;
};

type GraphMediaPage = {
  data?: GraphMedia[];
  paging?: { next?: string };
  error?: GraphError;
};

type GraphInsight = {
  name: string;
  values?: Array<{ value?: number }>;
};

type GraphInsightsResponse = {
  data?: GraphInsight[];
  error?: GraphError;
};

type SyncError = {
  postId?: string;
  stage: "media" | "insights" | "account_save" | "post_save" | "snapshot_save";
  message: string;
  code?: number;
  subcode?: number;
  traceId?: string;
};

type SyncedAccount = {
  id: string;
  name: string;
  username: string;
};

type SyncTriggerType = "manual" | "scheduled";

type SyncResponseBody = {
  success: boolean;
  skipped?: boolean;
  fetchedPosts: number;
  savedPosts: number;
  savedSnapshots: number;
  failedPosts: number;
  apiMode: string;
  account: SyncedAccount | null;
  capturedAt: string;
  errors: SyncError[];
  error?: string;
};

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "username",
  "like_count",
  "comments_count"
].join(",");

const INSIGHT_METRICS = "views,reach,saved,shares,total_interactions";

function graphErrorMessage(error: GraphError | undefined, fallback: string) {
  return error?.message || fallback;
}

function logSyncError(error: SyncError) {
  // Tokens and request URLs are intentionally excluded from server logs.
  console.error("[instagram-sync]", JSON.stringify(error));
}

async function graphRequest<T extends { error?: GraphError }>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T;
  if (!response.ok || data.error) {
    const error = new Error(graphErrorMessage(data.error, `Graph API request failed (${response.status})`));
    Object.assign(error, { graphError: data.error, status: response.status });
    throw error;
  }
  return data;
}

async function supabaseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase環境変数が設定されていません。");

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function saveSyncRun(run: Omit<InstagramSyncRun, "id">) {
  await supabaseRequest<unknown[]>("instagram_sync_runs", {
    method: "POST",
    body: JSON.stringify({
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
      errors: run.errors
    })
  });
}

async function safeSaveSyncRun(run: Omit<InstagramSyncRun, "id">) {
  try {
    await saveSyncRun(run);
  } catch (error) {
    console.error("[instagram-sync-run-save]", error);
  }
}

async function getLatestScheduledSyncRun() {
  const rows = await supabaseRequest<Array<{ finished_at: string }>>(
    "instagram_sync_runs?trigger_type=eq.scheduled&select=finished_at&order=finished_at.desc&limit=1",
    { method: "GET" }
  );
  return rows[0]?.finished_at ?? null;
}

function getCurrentScheduledSlotStart(now: Date) {
  const slot = new Date(now);
  slot.setSeconds(0, 0);
  slot.setMinutes(17, 0, 0);
  if (now.getMinutes() < 17) {
    slot.setHours(slot.getHours() - 1);
  }
  return slot;
}

function hasRunForScheduledSlot(latestScheduledFinishedAt: string | null, slotStart: Date) {
  if (!latestScheduledFinishedAt) return false;
  return new Date(latestScheduledFinishedAt).getTime() >= slotStart.getTime();
}

async function findOrCreateAccount(posts: GraphMedia[]): Promise<SyncedAccount | null> {
  const username = posts.find((post) => post.username)?.username?.replace(/^@/, "").trim();
  if (!username) return null;

  const linkedByApiUsername = await supabaseRequest<SyncedAccount[]>(
    `instagram_accounts?instagram_api_username=eq.${encodeURIComponent(username)}&select=id,name,username&limit=1`,
    { method: "GET" }
  );
  if (linkedByApiUsername[0]) return linkedByApiUsername[0];

  const existing = await supabaseRequest<SyncedAccount[]>(
    `instagram_accounts?username=eq.${encodeURIComponent(username)}&select=id,name,username&limit=1`,
    { method: "GET" }
  );
  if (existing[0]) return existing[0];

  const created = await supabaseRequest<SyncedAccount[]>("instagram_accounts", {
    method: "POST",
    body: JSON.stringify({
      name: username,
      username,
      instagram_api_username: username,
      profile_url: `https://www.instagram.com/${encodeURIComponent(username)}/`,
      industry: "",
      target_audience: "",
      goal: "",
      memo: "Instagram Graph API同期時に自動登録"
    })
  });
  return created[0] ?? null;
}

function toSyncError(error: unknown, stage: SyncError["stage"], postId?: string): SyncError {
  const graphError = error && typeof error === "object" && "graphError" in error
    ? (error as { graphError?: GraphError }).graphError
    : undefined;
  return {
    postId,
    stage,
    message: error instanceof Error ? error.message : "不明なエラー",
    code: graphError?.code,
    subcode: graphError?.error_subcode,
    traceId: graphError?.fbtrace_id
  };
}

async function fetchAllMedia(config: InstagramGraphConfig) {
  const firstUrl = createInstagramGraphUrl(config, `${config.accountResource}/media`);
  firstUrl.searchParams.set("fields", MEDIA_FIELDS);
  firstUrl.searchParams.set("limit", "100");
  firstUrl.searchParams.set("access_token", config.accessToken);

  const posts: GraphMedia[] = [];
  let nextUrl: URL | null = firstUrl;
  while (nextUrl) {
    const page: GraphMediaPage = await graphRequest<GraphMediaPage>(nextUrl);
    posts.push(...(page.data || []));
    nextUrl = page.paging?.next ? new URL(page.paging.next) : null;
  }
  return posts;
}

async function fetchInsights(postId: string, config: InstagramGraphConfig) {
  const url = createInstagramGraphUrl(config, `${postId}/insights`);
  url.searchParams.set("metric", INSIGHT_METRICS);
  url.searchParams.set("access_token", config.accessToken);
  const response = await graphRequest<GraphInsightsResponse>(url);
  const values = Object.fromEntries(
    (response.data || []).map((metric) => [metric.name, Number(metric.values?.[0]?.value || 0)])
  );
  return {
    views: values.views || 0,
    reach: values.reach || 0,
    saved: values.saved || 0,
    shares: values.shares || 0,
    total_interactions: values.total_interactions || 0
  };
}

function legacyPostType(mediaType: string | undefined) {
  if (mediaType === "CAROUSEL_ALBUM") return "carousel";
  if (mediaType === "VIDEO") return "video";
  return "image";
}

async function syncPost(post: GraphMedia, config: InstagramGraphConfig, capturedAt: string, accountId: string | null) {
  const errors: SyncError[] = [];
  const timestamp = post.timestamp || capturedAt;
  const date = timestamp.slice(0, 10);

  try {
    await supabaseRequest<unknown[]>("instagram_posts?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: post.id,
        account_id: accountId,
        caption: post.caption || "",
        media_type: post.media_type || null,
        media_url: post.media_url || null,
        thumbnail_url: post.thumbnail_url || null,
        permalink: post.permalink || null,
        timestamp,
        username: post.username || null,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        updated_at: capturedAt,
        // Existing manual-entry columns remain populated for app compatibility.
        date,
        recorded_date: capturedAt.slice(0, 10),
        url: post.permalink || "",
        type: legacyPostType(post.media_type),
        likes: post.like_count || 0,
        comments: post.comments_count || 0
      })
    });
  } catch (error) {
    const detail = toSyncError(error, "post_save", post.id);
    logSyncError(detail);
    errors.push(detail);
    return { postSaved: false, snapshotSaved: false, errors };
  }

  let insights;
  try {
    insights = await fetchInsights(post.id, config);
  } catch (error) {
    const detail = toSyncError(error, "insights", post.id);
    logSyncError(detail);
    errors.push(detail);
    return { postSaved: true, snapshotSaved: false, errors };
  }

  try {
    await supabaseRequest<unknown[]>("instagram_post_insight_snapshots", {
      method: "POST",
      body: JSON.stringify({
        post_id: post.id,
        captured_at: capturedAt,
        ...insights,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0
      })
    });
    return { postSaved: true, snapshotSaved: true, errors };
  } catch (error) {
    const detail = toSyncError(error, "snapshot_save", post.id);
    logSyncError(detail);
    errors.push(detail);
    return { postSaved: true, snapshotSaved: false, errors };
  }
}

async function handler(triggerType: SyncTriggerType) {
  const startedAt = new Date().toISOString();
  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY"
  ].filter(Boolean);
  if (missing.length) {
    const capturedAt = new Date().toISOString();
    const payload: SyncResponseBody = {
      success: false,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: "unknown",
      account: null,
      capturedAt,
      errors: [],
      error: `環境変数が不足しています: ${missing.join(", ")}`
    };
    await safeSaveSyncRun({
      triggerType,
      status: "failed",
      startedAt,
      finishedAt: capturedAt,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: "unknown",
      errorSummary: payload.error,
      errors: []
    });
    return NextResponse.json(payload, { status: 500 });
  }

  if (triggerType === "scheduled") {
    try {
      const now = new Date();
      const slotStart = getCurrentScheduledSlotStart(now);
      const latestScheduledFinishedAt = await getLatestScheduledSyncRun();
      if (hasRunForScheduledSlot(latestScheduledFinishedAt, slotStart)) {
        return NextResponse.json({
          success: true,
          skipped: true,
          fetchedPosts: 0,
          savedPosts: 0,
          savedSnapshots: 0,
          failedPosts: 0,
          apiMode: "scheduled",
          account: null,
          capturedAt: now.toISOString(),
          errors: []
        } satisfies SyncResponseBody);
      }
    } catch (error) {
      console.error("[instagram-sync-slot-check]", error);
    }
  }

  let config: InstagramGraphConfig;
  try {
    config = await getInstagramGraphConfig();
  } catch (error) {
    const capturedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Instagram API設定が不正です。";
    const payload: SyncResponseBody = {
      success: false,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: "unknown",
      account: null,
      capturedAt,
      errors: [],
      error: message
    };
    await safeSaveSyncRun({
      triggerType,
      status: "failed",
      startedAt,
      finishedAt: capturedAt,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: "unknown",
      errorSummary: message,
      errors: []
    });
    return NextResponse.json(payload, { status: 500 });
  }

  let posts: GraphMedia[];
  try {
    posts = await fetchAllMedia(config);
  } catch (error) {
    const detail = toSyncError(error, "media");
    logSyncError(detail);
    const capturedAt = new Date().toISOString();
    const payload: SyncResponseBody = {
      success: false,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: config.mode,
      account: null,
      capturedAt,
      errors: [detail],
      error: "Instagram投稿の取得に失敗しました。"
    };
    await safeSaveSyncRun({
      triggerType,
      status: "failed",
      startedAt,
      finishedAt: capturedAt,
      fetchedPosts: 0,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: config.mode,
      errorSummary: payload.error,
      errors: [detail]
    });
    return NextResponse.json(payload, { status: 502 });
  }

  const capturedAt = new Date().toISOString();
  let syncedAccount: SyncedAccount | null = null;
  try {
    syncedAccount = await findOrCreateAccount(posts);
  } catch (error) {
    const detail = toSyncError(error, "account_save");
    logSyncError(detail);
    const payload: SyncResponseBody = {
      success: false,
      fetchedPosts: posts.length,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: config.mode,
      account: null,
      capturedAt,
      errors: [detail],
      error: "Instagramアカウントの保存に失敗しました。"
    };
    await safeSaveSyncRun({
      triggerType,
      status: "failed",
      startedAt,
      finishedAt: capturedAt,
      fetchedPosts: posts.length,
      savedPosts: 0,
      savedSnapshots: 0,
      failedPosts: 0,
      apiMode: config.mode,
      errorSummary: payload.error,
      errors: [detail]
    });
    return NextResponse.json(payload, { status: 500 });
  }

  const results = [];
  const concurrency = 5;
  for (let index = 0; index < posts.length; index += concurrency) {
    results.push(...await Promise.all(
      posts.slice(index, index + concurrency).map((post) => syncPost(post, config, capturedAt, syncedAccount?.id ?? null))
    ));
  }

  const errors = results.flatMap((result) => result.errors);
  const payload: SyncResponseBody = {
    success: errors.length === 0,
    fetchedPosts: posts.length,
    savedPosts: results.filter((result) => result.postSaved).length,
    savedSnapshots: results.filter((result) => result.snapshotSaved).length,
    failedPosts: results.filter((result) => result.errors.length > 0).length,
    apiMode: config.mode,
    account: syncedAccount,
    capturedAt,
    errors
  };
  await safeSaveSyncRun({
    triggerType,
    status: errors.length === 0 ? "success" : payload.savedPosts > 0 || payload.savedSnapshots > 0 ? "partial" : "failed",
    startedAt,
    finishedAt: capturedAt,
    fetchedPosts: payload.fetchedPosts,
    savedPosts: payload.savedPosts,
    savedSnapshots: payload.savedSnapshots,
    failedPosts: payload.failedPosts,
    apiMode: payload.apiMode,
    accountId: syncedAccount?.id,
    accountName: syncedAccount?.name,
    accountUsername: syncedAccount?.username,
    errorSummary: errors[0]?.message,
    errors
  });
  return NextResponse.json(payload, { status: errors.length ? 207 : 200 });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRETが設定されていません。" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handler("scheduled");
}

export async function POST() {
  return handler("manual");
}
