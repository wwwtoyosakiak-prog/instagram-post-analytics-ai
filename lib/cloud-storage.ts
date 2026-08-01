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
import { ClientApiError, requestJson } from "@/lib/client-api";
import { InstagramAccount, InstagramInsightSnapshot, InstagramPost, InstagramPostInput, InstagramSyncRun } from "@/lib/types";
import { AiAnalysis, AiAnalysisRecord, MonthlyReport, MonthlyReportRecord } from "@/lib/types";

type ServerStatus = {
  mode: "supabase" | "local";
  serverStorageEnabled: boolean;
};

async function requestStorageJson<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(url, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    if (error instanceof ClientApiError && error.status === 501) {
      throw new Error("SERVER_STORAGE_DISABLED");
    }
    throw error;
  }
}

function isServerStorageDisabled(error: unknown) {
  return error instanceof Error && error.message === "SERVER_STORAGE_DISABLED";
}

export async function getServerStorageStatus(): Promise<ServerStatus> {
  try {
    return await requestStorageJson<ServerStatus>("/api/data/status");
  } catch {
    return { mode: "local", serverStorageEnabled: false };
  }
}

export async function loadAccountsData() {
  try {
    const data = await requestStorageJson<{ accounts: InstagramAccount[] }>("/api/data/accounts");
    saveAccounts(data.accounts);
    return data.accounts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadAccounts();
  }
}

export async function loadPostsData() {
  try {
    const data = await requestStorageJson<{ posts: InstagramPost[] }>("/api/data/posts");
    savePosts(data.posts);
    return data.posts;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return loadPosts();
  }
}

export async function updatePostData(id: string, input: InstagramPostInput) {
  try {
    const data = await requestStorageJson<{ post: InstagramPost | null }>("/api/data/posts", {
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
    await requestStorageJson<{ ok: true }>(`/api/data/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deletePost(id);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    deletePost(id);
  }
}

export async function loadAnalysesData(postId: string): Promise<AiAnalysisRecord[]> {
  try {
    const data = await requestStorageJson<{ analyses: AiAnalysisRecord[] }>(`/api/data/analyses?postId=${encodeURIComponent(postId)}`);
    return data.analyses;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function loadInsightData(postId: string): Promise<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }> {
  try {
    return await requestStorageJson<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }>(`/api/data/insights?postId=${encodeURIComponent(postId)}`);
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return { insight: null, insights: [] };
  }
}

export async function loadAllInsightData(): Promise<InstagramInsightSnapshot[]> {
  try {
    const data = await requestStorageJson<{ insights: InstagramInsightSnapshot[] }>("/api/data/insights?all=true");
    return data.insights;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function loadSyncRunsData(): Promise<InstagramSyncRun[]> {
  try {
    const data = await requestStorageJson<{ syncRuns: InstagramSyncRun[] }>("/api/data/sync-runs");
    return data.syncRuns;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveAnalysisData(postId: string, analysis: AiAnalysis): Promise<AiAnalysisRecord | null> {
  try {
    const data = await requestStorageJson<{ analysis: AiAnalysisRecord }>("/api/data/analyses", {
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
    const data = await requestStorageJson<{ reports: MonthlyReportRecord[] }>(`/api/data/monthly-reports?${params.toString()}`);
    return data.reports;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return [];
  }
}

export async function saveMonthlyReportData(report: MonthlyReport, accountId: string | null, accountName: string): Promise<MonthlyReportRecord | null> {
  try {
    const data = await requestStorageJson<{ report: MonthlyReportRecord }>("/api/data/monthly-reports", {
      method: "POST",
      body: JSON.stringify({ report, accountId, accountName })
    });
    return data.report;
  } catch (error) {
    if (!isServerStorageDisabled(error)) console.warn(error);
    return null;
  }
}
