import { AiAnalysis, AiAnalysisRecord, AiScoreHistory, AiScoreHistoryInput, InstagramAccessTokenStorage, InstagramAccount, InstagramAccountInput, InstagramInsightSnapshot, InstagramOperationDomain, InstagramOperationLog, InstagramOperationResult, InstagramOperationType, InstagramPost, InstagramPostInput, InstagramSyncRun, MonthlyReport, MonthlyReportRecord, PostType } from "@/lib/types";
import { normalizeAiAnalysis } from "@/lib/ai-analysis";
import { scoreHistoryFromAnalysis } from "@/lib/score-history";
import { supabaseRestRequest } from "@/lib/supabase-server";
import { DEFAULT_DATA_OWNER } from "@/lib/authenticated-user";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

function ownerFilter(ownerId: string) {
  return `owner_id=eq.${encodeURIComponent(ownerId)}`;
}

function withOwnerFilter(ownerId: string, filters: string) {
  return process.env.USER_DATA_OWNERSHIP_ENABLED === "true" ? `${ownerFilter(ownerId)}&${filters}` : filters;
}

function ownerField(ownerId: string) {
  return process.env.USER_DATA_OWNERSHIP_ENABLED === "true" ? { owner_id: ownerId } : {};
}

type AccountRow = {
  id: string;
  name: string;
  username: string;
  instagram_api_username: string | null;
  profile_url: string | null;
  industry: string | null;
  target_audience: string | null;
  goal: string | null;
  openai_api_key_env_name: string | null;
  openai_model: string | null;
  analysis_instructions: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PostRow = {
  id: string;
  account_id: string | null;
  date: string;
  recorded_date: string;
  url: string | null;
  caption: string;
  hashtags: string | null;
  type: PostType;
  category: string | null;
  media_count: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  memo: string | null;
  screenshot: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
};

type AnalysisRow = {
  id: string;
  post_id: string;
  first_impression: string;
  image_message: string;
  caption_clarity: string;
  strengths: string;
  weaknesses: string;
  reason: string;
  improvements: string[];
  next_ideas: string[];
  hashtags: string[];
  score: number;
  score_delta: number | null;
  analysis_v2: Record<string, unknown> | null;
  created_at: string;
};

type ScoreHistoryRow = {
  id: number;
  post_id: string;
  analysis_id: string | null;
  score: number;
  content_score: number | null;
  visual_score: number | null;
  caption_score: number | null;
  engagement_score: number | null;
  discoverability_score: number | null;
  created_at: string;
};

type InsightSnapshotRow = {
  id: string;
  post_id: string;
  captured_at: string;
  views: number;
  reach: number;
  saved: number;
  shares: number;
  total_interactions: number;
  like_count: number;
  comments_count: number;
  likes: number;
  comments: number;
  follows: number;
  profile_visits: number;
  ig_reels_avg_watch_time: number | null;
  ig_reels_video_view_total_time: number | null;
  clips_replays_count: number | null;
};

type MonthlyReportRow = {
  id: string;
  month: string;
  account_id: string | null;
  account_name: string;
  total_views: number;
  average_likes: number;
  average_saves: number;
  average_engagement_rate: number;
  top_posts: InstagramPost[];
  needs_work_posts: InstagramPost[];
  summary: string;
  next_month_policy: string[];
  created_at: string;
  updated_at: string;
};

type SyncRunRow = {
  id: string;
  trigger_type: "manual" | "scheduled";
  status: "success" | "partial" | "failed";
  started_at: string;
  finished_at: string;
  fetched_posts: number;
  saved_posts: number;
  saved_snapshots: number;
  failed_posts: number;
  api_mode: string;
  account_id: string | null;
  account_name: string | null;
  account_username: string | null;
  error_summary: string | null;
  errors: Array<{
    postId?: string;
    stage: string;
    message: string;
    code?: number;
    subcode?: number;
    traceId?: string;
  }> | null;
};

type InstagramAccessTokenRow = {
  provider: string;
  access_token: string;
  issued_at: string | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
  next_refresh_at: string | null;
  status: "missing" | "environment_only" | "active" | "expiring_soon" | "expired" | "refresh_failed";
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type InstagramOperationLogRow = {
  id: string;
  domain: InstagramOperationDomain;
  operation_type: InstagramOperationType;
  result: InstagramOperationResult;
  message: string | null;
  error_detail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function assertConfigured() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  return supabaseRestRequest<T>(path, init);
}

function mapAccount(row: AccountRow): InstagramAccount {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    instagramApiUsername: row.instagram_api_username ?? "",
    profileUrl: row.profile_url ?? "",
    industry: row.industry ?? "",
    targetAudience: row.target_audience ?? "",
    goal: row.goal ?? "",
    openaiApiKeyEnvName: row.openai_api_key_env_name ?? "",
    openaiModel: row.openai_model ?? "",
    analysisInstructions: row.analysis_instructions ?? "",
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function accountToRow(input: InstagramAccountInput) {
  return {
    name: input.name,
    username: input.username,
    instagram_api_username: input.instagramApiUsername || null,
    profile_url: input.profileUrl,
    industry: input.industry,
    target_audience: input.targetAudience,
    goal: input.goal,
    openai_api_key_env_name: input.openaiApiKeyEnvName,
    openai_model: input.openaiModel,
    analysis_instructions: input.analysisInstructions,
    memo: input.memo
  };
}

function mapPost(row: PostRow): InstagramPost {
  return {
    id: row.id,
    accountId: row.account_id ?? undefined,
    date: row.date,
    recordedDate: row.recorded_date,
    url: row.url ?? "",
    caption: row.caption,
    hashtags: row.hashtags ?? "",
    type: row.type,
    mediaCount: row.media_count,
    likes: row.likes,
    comments: row.comments,
    saves: row.saves,
    shares: row.shares,
    views: row.views,
    memo: row.memo ?? "",
    screenshot: row.screenshot ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    instagramUsername: row.username ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function postToRow(input: InstagramPostInput) {
  return {
    account_id: input.accountId || null,
    date: input.date,
    recorded_date: input.recordedDate,
    url: input.url,
    caption: input.caption,
    hashtags: input.hashtags,
    type: input.type,
    media_count: input.mediaCount,
    likes: input.likes,
    comments: input.comments,
    saves: input.saves,
    shares: input.shares,
    views: input.views,
    memo: input.memo,
    screenshot: input.screenshot ?? null,
    media_url: input.mediaUrl,
    thumbnail_url: input.thumbnailUrl,
    media_type: input.mediaType,
    username: input.instagramUsername
  };
}

function mapAnalysis(row: AnalysisRow): AiAnalysisRecord {
  const normalized = normalizeAiAnalysis({
    firstImpression: row.first_impression,
    imageMessage: row.image_message,
    captionClarity: row.caption_clarity,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    reason: row.reason,
    improvements: row.improvements ?? [],
    nextIdeas: row.next_ideas ?? [],
    hashtags: row.hashtags ?? [],
    score: row.score,
    ...(row.analysis_v2 ?? {}),
  });
  return { id: row.id, postId: row.post_id, ...normalized, scoreDelta: row.score_delta, createdAt: row.created_at };
}

function mapScoreHistory(row: ScoreHistoryRow): AiScoreHistory {
  return {
    id: row.id,
    postId: row.post_id,
    analysisId: row.analysis_id,
    score: Number(row.score),
    contentScore: row.content_score == null ? null : Number(row.content_score),
    visualScore: row.visual_score == null ? null : Number(row.visual_score),
    captionScore: row.caption_score == null ? null : Number(row.caption_score),
    engagementScore: row.engagement_score == null ? null : Number(row.engagement_score),
    discoverabilityScore: row.discoverability_score == null ? null : Number(row.discoverability_score),
    createdAt: row.created_at,
  };
}

function scoreHistoryToRow(input: AiScoreHistoryInput) {
  return {
    post_id: input.postId,
    analysis_id: input.analysisId,
    score: input.score,
    content_score: input.contentScore,
    visual_score: input.visualScore,
    caption_score: input.captionScore,
    engagement_score: input.engagementScore,
    discoverability_score: input.discoverabilityScore,
  };
}

function mapInsightSnapshot(row: InsightSnapshotRow): InstagramInsightSnapshot {
  return {
    id: row.id,
    postId: row.post_id,
    capturedAt: row.captured_at,
    views: Number(row.views),
    reach: Number(row.reach),
    saved: Number(row.saved),
    shares: Number(row.shares),
    totalInteractions: Number(row.total_interactions),
    likeCount: Number(row.like_count),
    commentsCount: Number(row.comments_count),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    follows: Number(row.follows ?? 0),
    profileVisits: Number(row.profile_visits ?? 0),
    reelAvgWatchTime: row.ig_reels_avg_watch_time != null ? Number(row.ig_reels_avg_watch_time) : null,
    reelTotalViewTime: row.ig_reels_video_view_total_time != null ? Number(row.ig_reels_video_view_total_time) : null,
    reelClipsReplaysCount: row.clips_replays_count != null ? Number(row.clips_replays_count) : null,
  };
}

function mapSyncRun(row: SyncRunRow): InstagramSyncRun {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    fetchedPosts: row.fetched_posts,
    savedPosts: row.saved_posts,
    savedSnapshots: row.saved_snapshots,
    failedPosts: row.failed_posts,
    apiMode: row.api_mode,
    accountId: row.account_id ?? undefined,
    accountName: row.account_name ?? undefined,
    accountUsername: row.account_username ?? undefined,
    errorSummary: row.error_summary ?? undefined,
    errors: row.errors ?? []
  };
}

function mapInstagramAccessToken(row: InstagramAccessTokenRow): InstagramAccessTokenStorage {
  return {
    provider: row.provider,
    accessToken: row.access_token,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    lastRefreshedAt: row.last_refreshed_at,
    nextRefreshAt: row.next_refresh_at,
    status: row.status,
    lastError: row.last_error,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function instagramAccessTokenToRow(record: InstagramAccessTokenStorage) {
  return {
    provider: record.provider,
    access_token: record.accessToken,
    issued_at: record.issuedAt ?? null,
    expires_at: record.expiresAt ?? null,
    last_refreshed_at: record.lastRefreshedAt ?? null,
    next_refresh_at: record.nextRefreshAt ?? null,
    status: record.status,
    last_error: record.lastError ?? null,
    last_checked_at: record.lastCheckedAt ?? null
  };
}

function mapInstagramOperationLog(row: InstagramOperationLogRow): InstagramOperationLog {
  return {
    id: row.id,
    domain: row.domain,
    operationType: row.operation_type,
    result: row.result,
    message: row.message ?? "",
    errorDetail: row.error_detail,
    metadata: row.metadata ?? {},
    createdAt: row.created_at
  };
}

function instagramOperationLogToRow(log: Omit<InstagramOperationLog, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  return {
    id: log.id,
    domain: log.domain,
    operation_type: log.operationType,
    result: log.result,
    message: log.message,
    error_detail: log.errorDetail ?? null,
    metadata: log.metadata ?? {},
    created_at: log.createdAt
  };
}

function analysisToRow(postId: string, analysis: AiAnalysis, scoreDelta: number | null) {
  return {
    post_id: postId,
    first_impression: analysis.firstImpression,
    image_message: analysis.imageMessage,
    caption_clarity: analysis.captionClarity,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    reason: analysis.reason,
    improvements: analysis.improvements,
    next_ideas: analysis.nextIdeas,
    hashtags: analysis.hashtags,
    score: analysis.score,
    score_delta: scoreDelta,
    analysis_v2: { analysisVersion: analysis.analysisVersion ?? 2, improvementsDetailed: analysis.improvementsDetailed ?? [], hashtagSuggestion: analysis.hashtagSuggestion ?? null, postingTimeSuggestion: analysis.postingTimeSuggestion ?? null, captionSuggestion: analysis.captionSuggestion ?? null, scoreBreakdown: analysis.scoreBreakdown ?? null }
  };
}

function mapMonthlyReport(row: MonthlyReportRow): MonthlyReportRecord {
  return {
    id: row.id,
    month: row.month,
    accountId: row.account_id,
    accountName: row.account_name,
    totalViews: row.total_views,
    averageLikes: row.average_likes,
    averageSaves: row.average_saves,
    averageEngagementRate: row.average_engagement_rate,
    topPosts: row.top_posts ?? [],
    needsWorkPosts: row.needs_work_posts ?? [],
    summary: row.summary,
    nextMonthPolicy: row.next_month_policy ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function monthlyReportToRow(report: MonthlyReport, accountId: string | null, accountName: string) {
  return {
    month: report.month,
    account_id: accountId === "all" ? null : accountId,
    account_name: accountName,
    total_views: report.totalViews,
    average_likes: report.averageLikes,
    average_saves: report.averageSaves,
    average_engagement_rate: report.averageEngagementRate,
    top_posts: report.topPosts,
    needs_work_posts: report.needsWorkPosts,
    summary: report.summary,
    next_month_policy: report.nextMonthPolicy
  };
}

export async function listAccountsFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<AccountRow[]>(`instagram_accounts?${withOwnerFilter(ownerId, "select=*&order=created_at.desc")}`);
  return rows.map(mapAccount);
}

export async function createAccountInSupabase(input: InstagramAccountInput, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<AccountRow[]>("instagram_accounts", {
    method: "POST",
    body: JSON.stringify({ ...accountToRow(input), ...ownerField(ownerId) })
  });
  return mapAccount(rows[0]);
}

export async function updateAccountInSupabase(id: string, input: InstagramAccountInput, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<AccountRow[]>(`instagram_accounts?${withOwnerFilter(ownerId, `id=eq.${encodeURIComponent(id)}`)}`, {
    method: "PATCH",
    body: JSON.stringify(accountToRow(input))
  });
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function deleteAccountFromSupabase(id: string, ownerId = DEFAULT_DATA_OWNER) {
  await supabaseRequest<void>(`instagram_accounts?${withOwnerFilter(ownerId, `id=eq.${encodeURIComponent(id)}`)}`, { method: "DELETE" });
}

export async function upsertAccountsInSupabase(accounts: InstagramAccount[], ownerId = DEFAULT_DATA_OWNER) {
  const rows = accounts.map((account) => ({
    id: account.id,
    ...ownerField(ownerId),
    ...accountToRow(account),
    created_at: account.createdAt,
    updated_at: account.updatedAt
  }));
  const result = await supabaseRequest<AccountRow[]>("instagram_accounts?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapAccount);
}

export async function listPostsFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const [rows, latestInsights] = await Promise.all([
    supabaseRequest<PostRow[]>(`instagram_posts?${withOwnerFilter(ownerId, "select=*&order=date.desc")}`),
    listLatestInsightSnapshotsFromSupabase(ownerId)
  ]);
  const insightByPostId = new Map(latestInsights.map((insight) => [insight.postId, insight]));
  return rows.map((row) => {
    const post = mapPost(row);
    const insight = insightByPostId.get(post.id);
    if (!insight) return post;
    return {
      ...post,
      views: insight.views,
      saves: insight.saved,
      shares: insight.shares,
      likes: insight.likeCount,
      comments: insight.commentsCount,
      latestInsight: insight
    };
  });
}

export async function createPostInSupabase(input: InstagramPostInput, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<PostRow[]>("instagram_posts", {
    method: "POST",
    body: JSON.stringify({ ...postToRow(input), ...ownerField(ownerId) })
  });
  return mapPost(rows[0]);
}

export async function updatePostInSupabase(id: string, input: InstagramPostInput, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<PostRow[]>(`instagram_posts?${withOwnerFilter(ownerId, `id=eq.${encodeURIComponent(id)}`)}`, {
    method: "PATCH",
    body: JSON.stringify(postToRow(input))
  });
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function deletePostFromSupabase(id: string, ownerId = DEFAULT_DATA_OWNER) {
  await supabaseRequest<void>(`instagram_posts?${withOwnerFilter(ownerId, `id=eq.${encodeURIComponent(id)}`)}`, { method: "DELETE" });
}

export async function upsertPostsInSupabase(posts: InstagramPost[], ownerId = DEFAULT_DATA_OWNER) {
  const rows = posts.map((post) => ({
    id: post.id,
    ...ownerField(ownerId),
    ...postToRow(post),
    created_at: post.createdAt,
    updated_at: post.updatedAt
  }));
  const result = await supabaseRequest<PostRow[]>("instagram_posts?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapPost);
}

export async function listAnalysesFromSupabase(postId: string, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<AnalysisRow[]>(`instagram_post_analyses?${withOwnerFilter(ownerId, `post_id=eq.${encodeURIComponent(postId)}&select=*&order=created_at.desc`)}`);
  return rows.map(mapAnalysis);
}

export async function listLatestAnalysesFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<AnalysisRow[]>(`instagram_post_analyses?${withOwnerFilter(ownerId, "select=*&order=created_at.desc")}`);
  const latestByPostId = new Map<string, AiAnalysisRecord>();
  for (const row of rows) {
    if (!latestByPostId.has(row.post_id)) latestByPostId.set(row.post_id, mapAnalysis(row));
  }
  return [...latestByPostId.values()];
}

export async function createScoreHistoryInSupabase(input: AiScoreHistoryInput, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<ScoreHistoryRow[]>("ai_score_history", {
    method: "POST",
    body: JSON.stringify({ ...scoreHistoryToRow(input), ...ownerField(ownerId) })
  });
  return mapScoreHistory(rows[0]);
}

export async function listScoreHistoryFromSupabase(postId?: string, limit = 100, ownerId = DEFAULT_DATA_OWNER) {
  const filters = ["select=*", "order=created_at.asc", `limit=${limit}`];
  if (process.env.USER_DATA_OWNERSHIP_ENABLED === "true") filters.unshift(ownerFilter(ownerId));
  if (postId) filters.push(`post_id=eq.${encodeURIComponent(postId)}`);
  const rows = await supabaseRequest<ScoreHistoryRow[]>(`ai_score_history?${filters.join("&")}`);
  return rows.map(mapScoreHistory);
}

export async function createAnalysisInSupabase(postId: string, analysis: AiAnalysis, ownerId = DEFAULT_DATA_OWNER) {
  const previous = await listAnalysesFromSupabase(postId, ownerId);
  const scoreDelta = previous[0] ? analysis.score - previous[0].score : null;
  const rows = await supabaseRequest<AnalysisRow[]>("instagram_post_analyses", {
    method: "POST",
    body: JSON.stringify({ ...analysisToRow(postId, analysis, scoreDelta), ...ownerField(ownerId) })
  });
  const saved = mapAnalysis(rows[0]);
  await createScoreHistoryInSupabase(
    scoreHistoryFromAnalysis(postId, saved.id, analysis),
    ownerId
  );
  return saved;
}

export async function listInsightSnapshotsFromSupabase(postId: string, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<InsightSnapshotRow[]>(
    `instagram_post_insight_snapshots?${withOwnerFilter(ownerId, `post_id=eq.${encodeURIComponent(postId)}&select=*&order=captured_at.desc`)}`
  );
  return rows.map(mapInsightSnapshot);
}

export async function listAllInsightSnapshotsFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<InsightSnapshotRow[]>(
    `instagram_post_insight_snapshots?${withOwnerFilter(ownerId, "select=*&order=captured_at.asc")}`
  );
  return rows.map(mapInsightSnapshot);
}

export async function listLatestInsightSnapshotsFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<InsightSnapshotRow[]>(
    `instagram_post_insight_snapshots?${withOwnerFilter(ownerId, "select=*&order=captured_at.desc")}`
  );
  const latestByPostId = new Map<string, InstagramInsightSnapshot>();
  for (const row of rows) {
    if (!latestByPostId.has(row.post_id)) latestByPostId.set(row.post_id, mapInsightSnapshot(row));
  }
  return [...latestByPostId.values()];
}

export async function listSyncRunsFromSupabase(ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<SyncRunRow[]>(
    `instagram_sync_runs?${withOwnerFilter(ownerId, "select=*&order=finished_at.desc&limit=20")}`
  );
  return rows.map(mapSyncRun);
}

export async function getInstagramAccessTokenFromSupabase(provider = "instagram_graph_api") {
  const rows = await supabaseRequest<InstagramAccessTokenRow[]>(
    `instagram_access_tokens?provider=eq.${encodeURIComponent(provider)}&select=*&limit=1`
  );
  return rows[0] ? mapInstagramAccessToken(rows[0]) : null;
}

export async function upsertInstagramAccessTokenInSupabase(record: InstagramAccessTokenStorage) {
  const rows = await supabaseRequest<InstagramAccessTokenRow[]>("instagram_access_tokens?on_conflict=provider", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(instagramAccessTokenToRow(record))
  });
  return rows[0] ? mapInstagramAccessToken(rows[0]) : null;
}

export async function createInstagramOperationLogInSupabase(log: Omit<InstagramOperationLog, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const rows = await supabaseRequest<InstagramOperationLogRow[]>("instagram_operation_logs", {
    method: "POST",
    body: JSON.stringify(instagramOperationLogToRow(log))
  });
  return rows[0] ? mapInstagramOperationLog(rows[0]) : null;
}

export async function listInstagramOperationLogsFromSupabase(domain?: InstagramOperationDomain, limit = 20) {
  const filters = ["select=*", "order=created_at.desc", `limit=${limit}`];
  if (domain) filters.push(`domain=eq.${encodeURIComponent(domain)}`);
  const rows = await supabaseRequest<InstagramOperationLogRow[]>(`instagram_operation_logs?${filters.join("&")}`);
  return rows.map(mapInstagramOperationLog);
}

export async function getLatestInstagramOperationLogFromSupabase(domain: InstagramOperationDomain, operationType: InstagramOperationType) {
  const rows = await supabaseRequest<InstagramOperationLogRow[]>(
    `instagram_operation_logs?domain=eq.${encodeURIComponent(domain)}&operation_type=eq.${encodeURIComponent(operationType)}&select=*&order=created_at.desc&limit=1`
  );
  return rows[0] ? mapInstagramOperationLog(rows[0]) : null;
}

export async function listMonthlyReportsFromSupabase(accountId?: string | null, month?: string | null, ownerId = DEFAULT_DATA_OWNER) {
  const filters = ["select=*", "order=created_at.desc"];
  if (process.env.USER_DATA_OWNERSHIP_ENABLED === "true") filters.unshift(ownerFilter(ownerId));
  if (month) filters.push(`month=eq.${encodeURIComponent(month)}`);
  if (accountId && accountId !== "all") filters.push(`account_id=eq.${encodeURIComponent(accountId)}`);
  if (accountId === "all") filters.push("account_id=is.null");
  const rows = await supabaseRequest<MonthlyReportRow[]>(`instagram_monthly_reports?${filters.join("&")}`);
  return rows.map(mapMonthlyReport);
}

export async function createMonthlyReportInSupabase(report: MonthlyReport, accountId: string | null, accountName: string, ownerId = DEFAULT_DATA_OWNER) {
  const rows = await supabaseRequest<MonthlyReportRow[]>("instagram_monthly_reports", {
    method: "POST",
    body: JSON.stringify({ ...monthlyReportToRow(report, accountId, accountName), ...ownerField(ownerId) })
  });
  return mapMonthlyReport(rows[0]);
}
