"use client";

import {
  deletePost,
  loadAccounts,
  loadPosts,
  saveAccounts,
  savePosts,
  updatePost,
  upsertManyPosts,
} from "@/lib/storage";
import { InstagramAccount, InstagramInsightSnapshot, InstagramPost, InstagramPostInput, InstagramSyncRun } from "@/lib/types";
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
