import { AiAnalysis, AiAnalysisRecord, ImprovementTask, ImprovementTaskInput, ImprovementTaskStatus, InstagramAccount, InstagramAccountInput, InstagramPost, InstagramPostInput, MonthlyGoal, MonthlyGoalInput, MonthlyReport, MonthlyReportRecord, PostCategory, PostType } from "@/lib/types";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

type AccountRow = {
  id: string;
  name: string;
  username: string;
  profile_url: string | null;
  industry: string | null;
  target_audience: string | null;
  goal: string | null;
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
  category: PostCategory | null;
  media_count: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  memo: string | null;
  screenshot: string | null;
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
  created_at: string;
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

type TaskRow = {
  id: string;
  post_id: string | null;
  analysis_id: string | null;
  title: string;
  status: ImprovementTaskStatus;
  assignee: string | null;
  due_date: string | null;
  memo: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type GoalRow = {
  id: string;
  account_id: string | null;
  month: string;
  target_posts: number;
  target_views: number;
  target_saves: number;
  target_save_rate: number;
  target_engagement_rate: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

function assertConfigured() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapAccount(row: AccountRow): InstagramAccount {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    profileUrl: row.profile_url ?? "",
    industry: row.industry ?? "",
    targetAudience: row.target_audience ?? "",
    goal: row.goal ?? "",
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function accountToRow(input: InstagramAccountInput) {
  return {
    name: input.name,
    username: input.username,
    profile_url: input.profileUrl,
    industry: input.industry,
    target_audience: input.targetAudience,
    goal: input.goal,
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
    category: row.category ?? "other",
    mediaCount: row.media_count,
    likes: row.likes,
    comments: row.comments,
    saves: row.saves,
    shares: row.shares,
    views: row.views,
    memo: row.memo ?? "",
    screenshot: row.screenshot ?? undefined,
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
    category: input.category ?? "other",
    media_count: input.mediaCount,
    likes: input.likes,
    comments: input.comments,
    saves: input.saves,
    shares: input.shares,
    views: input.views,
    memo: input.memo,
    screenshot: input.screenshot ?? null
  };
}

function mapAnalysis(row: AnalysisRow): AiAnalysisRecord {
  return {
    id: row.id,
    postId: row.post_id,
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
    scoreDelta: row.score_delta,
    createdAt: row.created_at
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
    score_delta: scoreDelta
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

function mapTask(row: TaskRow): ImprovementTask {
  return {
    id: row.id,
    postId: row.post_id ?? undefined,
    analysisId: row.analysis_id ?? undefined,
    title: row.title,
    status: row.status,
    assignee: row.assignee ?? "",
    dueDate: row.due_date ?? "",
    memo: row.memo ?? "",
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function taskToRow(input: ImprovementTaskInput) {
  return {
    post_id: input.postId || null,
    analysis_id: input.analysisId || null,
    title: input.title,
    status: input.status,
    assignee: input.assignee,
    due_date: input.dueDate || null,
    memo: input.memo,
    completed_at: input.status === "done" ? new Date().toISOString() : null
  };
}

function mapGoal(row: GoalRow): MonthlyGoal {
  return {
    id: row.id,
    accountId: row.account_id,
    month: row.month,
    targetPosts: row.target_posts,
    targetViews: row.target_views,
    targetSaves: row.target_saves,
    targetSaveRate: row.target_save_rate,
    targetEngagementRate: row.target_engagement_rate,
    memo: row.memo ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function goalToRow(input: MonthlyGoalInput) {
  return {
    account_id: input.accountId && input.accountId !== "all" ? input.accountId : null,
    month: input.month,
    target_posts: input.targetPosts,
    target_views: input.targetViews,
    target_saves: input.targetSaves,
    target_save_rate: input.targetSaveRate,
    target_engagement_rate: input.targetEngagementRate,
    memo: input.memo
  };
}

export async function listAccountsFromSupabase() {
  const rows = await supabaseRequest<AccountRow[]>("instagram_accounts?select=*&order=created_at.desc");
  return rows.map(mapAccount);
}

export async function createAccountInSupabase(input: InstagramAccountInput) {
  const rows = await supabaseRequest<AccountRow[]>("instagram_accounts", {
    method: "POST",
    body: JSON.stringify(accountToRow(input))
  });
  return mapAccount(rows[0]);
}

export async function updateAccountInSupabase(id: string, input: InstagramAccountInput) {
  const rows = await supabaseRequest<AccountRow[]>(`instagram_accounts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(accountToRow(input))
  });
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function deleteAccountFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_accounts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertAccountsInSupabase(accounts: InstagramAccount[]) {
  const rows = accounts.map((account) => ({
    id: account.id,
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

export async function listPostsFromSupabase() {
  const rows = await supabaseRequest<PostRow[]>("instagram_posts?select=*&order=date.desc");
  return rows.map(mapPost);
}

export async function createPostInSupabase(input: InstagramPostInput) {
  const rows = await supabaseRequest<PostRow[]>("instagram_posts", {
    method: "POST",
    body: JSON.stringify(postToRow(input))
  });
  return mapPost(rows[0]);
}

export async function updatePostInSupabase(id: string, input: InstagramPostInput) {
  const rows = await supabaseRequest<PostRow[]>(`instagram_posts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(postToRow(input))
  });
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function deletePostFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_posts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertPostsInSupabase(posts: InstagramPost[]) {
  const rows = posts.map((post) => ({
    id: post.id,
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

export async function listAnalysesFromSupabase(postId: string) {
  const rows = await supabaseRequest<AnalysisRow[]>(`instagram_post_analyses?post_id=eq.${encodeURIComponent(postId)}&select=*&order=created_at.desc`);
  return rows.map(mapAnalysis);
}

export async function createAnalysisInSupabase(postId: string, analysis: AiAnalysis) {
  const previous = await listAnalysesFromSupabase(postId);
  const scoreDelta = previous[0] ? analysis.score - previous[0].score : null;
  const rows = await supabaseRequest<AnalysisRow[]>("instagram_post_analyses", {
    method: "POST",
    body: JSON.stringify(analysisToRow(postId, analysis, scoreDelta))
  });
  return mapAnalysis(rows[0]);
}

export async function listMonthlyReportsFromSupabase(accountId?: string | null, month?: string | null) {
  const filters = ["select=*", "order=created_at.desc"];
  if (month) filters.push(`month=eq.${encodeURIComponent(month)}`);
  if (accountId && accountId !== "all") filters.push(`account_id=eq.${encodeURIComponent(accountId)}`);
  if (accountId === "all") filters.push("account_id=is.null");
  const rows = await supabaseRequest<MonthlyReportRow[]>(`instagram_monthly_reports?${filters.join("&")}`);
  return rows.map(mapMonthlyReport);
}

export async function createMonthlyReportInSupabase(report: MonthlyReport, accountId: string | null, accountName: string) {
  const rows = await supabaseRequest<MonthlyReportRow[]>("instagram_monthly_reports", {
    method: "POST",
    body: JSON.stringify(monthlyReportToRow(report, accountId, accountName))
  });
  return mapMonthlyReport(rows[0]);
}

export async function listTasksFromSupabase(postId?: string | null) {
  const filters = ["select=*", "order=updated_at.desc"];
  if (postId) filters.push(`post_id=eq.${encodeURIComponent(postId)}`);
  const rows = await supabaseRequest<TaskRow[]>(`instagram_improvement_tasks?${filters.join("&")}`);
  return rows.map(mapTask);
}

export async function createTaskInSupabase(input: ImprovementTaskInput) {
  const rows = await supabaseRequest<TaskRow[]>("instagram_improvement_tasks", {
    method: "POST",
    body: JSON.stringify(taskToRow(input))
  });
  return mapTask(rows[0]);
}

export async function updateTaskInSupabase(id: string, input: ImprovementTaskInput) {
  const rows = await supabaseRequest<TaskRow[]>(`instagram_improvement_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(taskToRow(input))
  });
  return rows[0] ? mapTask(rows[0]) : null;
}

export async function deleteTaskFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_improvement_tasks?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertTasksInSupabase(tasks: ImprovementTask[]) {
  const rows = tasks.map((task) => ({
    id: task.id,
    ...taskToRow(task),
    completed_at: task.completedAt ?? (task.status === "done" ? new Date().toISOString() : null),
    created_at: task.createdAt,
    updated_at: task.updatedAt
  }));
  const result = await supabaseRequest<TaskRow[]>("instagram_improvement_tasks?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapTask);
}

export async function listGoalsFromSupabase(accountId?: string | null, month?: string | null) {
  const filters = ["select=*", "order=month.desc,updated_at.desc"];
  if (month) filters.push(`month=eq.${encodeURIComponent(month)}`);
  if (accountId && accountId !== "all") filters.push(`account_id=eq.${encodeURIComponent(accountId)}`);
  if (accountId === "all") filters.push("account_id=is.null");
  const rows = await supabaseRequest<GoalRow[]>(`instagram_monthly_goals?${filters.join("&")}`);
  return rows.map(mapGoal);
}

export async function createGoalInSupabase(input: MonthlyGoalInput) {
  const rows = await supabaseRequest<GoalRow[]>("instagram_monthly_goals", {
    method: "POST",
    body: JSON.stringify(goalToRow(input))
  });
  return mapGoal(rows[0]);
}

export async function updateGoalInSupabase(id: string, input: MonthlyGoalInput) {
  const rows = await supabaseRequest<GoalRow[]>(`instagram_monthly_goals?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(goalToRow(input))
  });
  return rows[0] ? mapGoal(rows[0]) : null;
}

export async function deleteGoalFromSupabase(id: string) {
  await supabaseRequest<void>(`instagram_monthly_goals?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function upsertGoalsInSupabase(goals: MonthlyGoal[]) {
  const rows = goals.map((goal) => ({
    id: goal.id,
    ...goalToRow(goal),
    created_at: goal.createdAt,
    updated_at: goal.updatedAt
  }));
  const result = await supabaseRequest<GoalRow[]>("instagram_monthly_goals?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return result.map(mapGoal);
}
