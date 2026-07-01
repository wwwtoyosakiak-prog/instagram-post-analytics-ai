"use client";

import {
  addAccount,
  addGoal,
  addPost,
  deleteAccount,
  deleteGoal,
  deletePost,
  loadAccounts,
  loadGoals,
  loadPosts,
  saveAccounts,
  saveGoals,
  savePosts,
  updateAccount,
  updateGoal,
  updatePost,
  upsertManyAccounts,
  upsertManyGoals,
  upsertManyPosts
} from "@/lib/storage";
import { InstagramAccount, InstagramAccountInput, InstagramInsightSnapshot, InstagramPost, InstagramPostInput, InstagramSyncRun, MonthlyGoal, MonthlyGoalInput } from "@/lib/types";
import { AiAnalysis, AiAnalysisRecord, MonthlyReport, MonthlyReportRecord } from "@/lib/types";

type ServerStatus = {
  mode: "supabase" | "local";
  serverStorageEnabled: boolean;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 501) {
    throw new Error("SERVER_STORAGE_DISABLED");
  }
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function isServerStorageDisabled(error: unknown) {
  return error instanceof Error && error.message === "SERVER_STORAGE_DISABLED";
}

export async function getServerStorageStatus(): Promise<ServerStatus> {
  try {
    return await requestJson<ServerStatus>("/api/data/status");
  } catch {
    return { mode: "local", serverStorageEnabled: false };
  }
}

export async function loadAccountsData() {
  try {
    const data = await requestJson<{ accounts: InstagramAccount[] }>("/api/data/accounts");
    saveAccounts(data.accounts);
    return data.accounts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadAccounts();
  }
}

export async function loadPostsData() {
  try {
    const data = await requestJson<{ posts: InstagramPost[] }>("/api/data/posts");
    savePosts(data.posts);
    return data.posts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadPosts();
  }
}

export async function addAccountData(input: InstagramAccountInput) {
  try {
    const data = await requestJson<{ account: InstagramAccount }>("/api/data/accounts", {
      method: "POST",
      body: JSON.stringify({ account: input })
    });
    upsertManyAccounts([data.account]);
    return data.account;
  } catch (error) {
    if (!isServerStorageDisabled(error)) throw error;
    return addAccount(input);
  }
}

export async function updateAccountData(id: string, input: InstagramAccountInput) {
  try {
    const data = await requestJson<{ account: InstagramAccount | null }>("/api/data/accounts", {
      method: "PUT",
      body: JSON.stringify({ id, account: input })
    });
    if (data.account) upsertManyAccounts([data.account]);
    return data.account;
  } catch (error) {
    if (!isServerStorageDisabled(error)) throw error;
    return updateAccount(id, input);
  }
}

export async function deleteAccountData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/accounts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deleteAccount(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) throw error;
    deleteAccount(id);
  }
}

export async function upsertAccountsData(accounts: InstagramAccount[]) {
  try {
    const data = await requestJson<{ accounts: InstagramAccount[] }>("/api/data/accounts", {
      method: "POST",
      body: JSON.stringify({ accounts })
    });
    upsertManyAccounts(data.accounts);
    return data.accounts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) throw error;
    upsertManyAccounts(accounts);
    return accounts;
  }
}

export async function addPostData(input: InstagramPostInput) {
  try {
    const data = await requestJson<{ post: InstagramPost }>("/api/data/posts", {
      method: "POST",
      body: JSON.stringify({ post: input })
    });
    upsertManyPosts([data.post]);
    return data.post;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addPost(input);
  }
}

export async function updatePostData(id: string, input: InstagramPostInput) {
  try {
    const data = await requestJson<{ post: InstagramPost | null }>("/api/data/posts", {
      method: "PUT",
      body: JSON.stringify({ id, post: input })
    });
    if (data.post) upsertManyPosts([data.post]);
    return data.post;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updatePost(id, input);
  }
}

export async function deletePostData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deletePost(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deletePost(id);
  }
}

export async function upsertPostsData(posts: InstagramPost[]) {
  try {
    const data = await requestJson<{ posts: InstagramPost[] }>("/api/data/posts", {
      method: "POST",
      body: JSON.stringify({ posts })
    });
    upsertManyPosts(data.posts);
    return data.posts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyPosts(posts);
    return posts;
  }
}

export async function pushLocalBackupToServer() {
  const accounts = loadAccounts();
  const posts = loadPosts();
  const goals = loadGoals();
  await upsertAccountsData(accounts);
  await upsertPostsData(posts);
  await upsertGoalsData(goals);
  return { accounts: accounts.length, posts: posts.length, goals: goals.length };
}

export async function loadAnalysesData(postId: string): Promise<AiAnalysisRecord[]> {
  try {
    const data = await requestJson<{ analyses: AiAnalysisRecord[] }>(`/api/data/analyses?postId=${encodeURIComponent(postId)}`);
    return data.analyses;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function loadInsightData(postId: string): Promise<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }> {
  try {
    return await requestJson<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }>(`/api/data/insights?postId=${encodeURIComponent(postId)}`);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return { insight: null, insights: [] };
  }
}

export async function loadAllInsightData(): Promise<InstagramInsightSnapshot[]> {
  try {
    const data = await requestJson<{ insights: InstagramInsightSnapshot[] }>("/api/data/insights?all=true");
    return data.insights;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function loadSyncRunsData(): Promise<InstagramSyncRun[]> {
  try {
    const data = await requestJson<{ syncRuns: InstagramSyncRun[] }>("/api/data/sync-runs");
    return data.syncRuns;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveAnalysisData(postId: string, analysis: AiAnalysis): Promise<AiAnalysisRecord | null> {
  try {
    const data = await requestJson<{ analysis: AiAnalysisRecord }>("/api/data/analyses", {
      method: "POST",
      body: JSON.stringify({ postId, analysis })
    });
    return data.analysis;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
  }
}

export async function loadMonthlyReportsData(accountId?: string, month?: string): Promise<MonthlyReportRecord[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (month) params.set("month", month);
  try {
    const data = await requestJson<{ reports: MonthlyReportRecord[] }>(`/api/data/monthly-reports?${params.toString()}`);
    return data.reports;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveMonthlyReportData(report: MonthlyReport, accountId: string | null, accountName: string): Promise<MonthlyReportRecord | null> {
  try {
    const data = await requestJson<{ report: MonthlyReportRecord }>("/api/data/monthly-reports", {
      method: "POST",
      body: JSON.stringify({ report, accountId, accountName })
    });
    return data.report;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
  }
}

export async function loadGoalsData(accountId?: string, month?: string): Promise<MonthlyGoal[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", accountId);
  if (month) params.set("month", month);
  try {
    const data = await requestJson<{ goals: MonthlyGoal[] }>(`/api/data/goals?${params.toString()}`);
    if (accountId || month) {
      upsertManyGoals(data.goals);
    } else {
      saveGoals(data.goals);
    }
    return data.goals;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadGoals().filter((goal) => (!accountId || goal.accountId === accountId || (accountId === "all" && !goal.accountId)) && (!month || goal.month === month));
  }
}

export async function addGoalData(input: MonthlyGoalInput) {
  try {
    const data = await requestJson<{ goal: MonthlyGoal }>("/api/data/goals", {
      method: "POST",
      body: JSON.stringify({ goal: input })
    });
    upsertManyGoals([data.goal]);
    return data.goal;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return addGoal(input);
  }
}

export async function updateGoalData(id: string, input: MonthlyGoalInput) {
  try {
    const data = await requestJson<{ goal: MonthlyGoal | null }>("/api/data/goals", {
      method: "PUT",
      body: JSON.stringify({ id, goal: input })
    });
    if (data.goal) upsertManyGoals([data.goal]);
    return data.goal;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return updateGoal(id, input);
  }
}

export async function deleteGoalData(id: string) {
  try {
    await requestJson<{ ok: true }>(`/api/data/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deleteGoal(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deleteGoal(id);
  }
}

export async function upsertGoalsData(goals: MonthlyGoal[]) {
  try {
    const data = await requestJson<{ goals: MonthlyGoal[] }>("/api/data/goals", {
      method: "POST",
      body: JSON.stringify({ goals })
    });
    upsertManyGoals(data.goals);
    return data.goals;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    upsertManyGoals(goals);
    return goals;
  }
}
