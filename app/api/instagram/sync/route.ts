import { NextResponse } from "next/server";

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
  stage: "media" | "insights" | "post_save" | "snapshot_save";
  message: string;
  code?: number;
  subcode?: number;
  traceId?: string;
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

async function fetchAllMedia(accountId: string, version: string, accessToken: string) {
  const firstUrl = new URL(`https://graph.facebook.com/${version}/${accountId}/media`);
  firstUrl.searchParams.set("fields", MEDIA_FIELDS);
  firstUrl.searchParams.set("limit", "100");
  firstUrl.searchParams.set("access_token", accessToken);

  const posts: GraphMedia[] = [];
  let nextUrl: URL | null = firstUrl;
  while (nextUrl) {
    const page: GraphMediaPage = await graphRequest<GraphMediaPage>(nextUrl);
    posts.push(...(page.data || []));
    nextUrl = page.paging?.next ? new URL(page.paging.next) : null;
  }
  return posts;
}

async function fetchInsights(postId: string, version: string, accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${version}/${postId}/insights`);
  url.searchParams.set("metric", INSIGHT_METRICS);
  url.searchParams.set("access_token", accessToken);
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

async function syncPost(post: GraphMedia, version: string, accessToken: string, capturedAt: string) {
  const errors: SyncError[] = [];
  const timestamp = post.timestamp || capturedAt;
  const date = timestamp.slice(0, 10);

  try {
    await supabaseRequest<unknown[]>("instagram_posts?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: post.id,
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
    insights = await fetchInsights(post.id, version, accessToken);
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

async function handler() {
  const accessToken = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v23.0";

  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !accountId && "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    !accessToken && "INSTAGRAM_GRAPH_ACCESS_TOKEN"
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ error: `環境変数が不足しています: ${missing.join(", ")}` }, { status: 500 });
  }

  let posts: GraphMedia[];
  try {
    posts = await fetchAllMedia(accountId!, version, accessToken!);
  } catch (error) {
    const detail = toSyncError(error, "media");
    logSyncError(detail);
    return NextResponse.json({ error: "Instagram投稿の取得に失敗しました。", details: [detail] }, { status: 502 });
  }

  const capturedAt = new Date().toISOString();
  const results = [];
  const concurrency = 5;
  for (let index = 0; index < posts.length; index += concurrency) {
    results.push(...await Promise.all(
      posts.slice(index, index + concurrency).map((post) => syncPost(post, version, accessToken!, capturedAt))
    ));
  }

  const errors = results.flatMap((result) => result.errors);
  return NextResponse.json({
    success: errors.length === 0,
    fetchedPosts: posts.length,
    savedPosts: results.filter((result) => result.postSaved).length,
    savedSnapshots: results.filter((result) => result.snapshotSaved).length,
    failedPosts: results.filter((result) => result.errors.length > 0).length,
    capturedAt,
    errors
  }, { status: errors.length ? 207 : 200 });
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}
