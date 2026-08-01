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
import { logClientIssue } from "@/lib/safe-logging";
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

function logStorageFallback(scope: string, error: unknown) {
  if (!isServerStorageDisabled(error)) logClientIssue(`storage-${scope}`, error);
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
    logStorageFallback("accounts-load", error);
    return loadAccounts();
  }
}

export async function loadPostsData() {
  try {
    const data = await requestStorageJson<{ posts: InstagramPost[] }>("/api/data/posts");
    savePosts(data.posts);
    return data.posts;
  } catch (error) {
    logStorageFallback("posts-load", error);
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
    logStorageFallback("post-update", error);
    return updatePost(id, input);
  }
}

export async function deletePostData(id: string) {
  try {
    await requestStorageJson<{ ok: true }>(`/api/data/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    deletePost(id);
  } catch (error) {
    logStorageFallback("post-delete", error);
    deletePost(id);
  }
}

export async function loadAnalysesData(postId: string): Promise<AiAnalysisRecord[]> {
  try {
    const data = await requestStorageJson<{ analyses: AiAnalysisRecord[] }>(`/api/data/analyses?postId=${encodeURIComponent(postId)}`);
    return data.analyses;
  } catch (error) {
    logStorageFallback("analyses-load", error);
    return [];
  }
}

export async function loadInsightData(postId: string): Promise<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }> {
  try {
    return await requestStorageJson<{ insight: InstagramInsightSnapshot | null; insights: InstagramInsightSnapshot[] }>(`/api/data/insights?postId=${encodeURIComponent(postId)}`);
  } catch (error) {
    logStorageFallback("insight-load", error);
    return { insight: null, insights: [] };
  }
}

export async function loadAllInsightData(): Promise<InstagramInsightSnapshot[]> {
  try {
    const data = await requestStorageJson<{ insights: InstagramInsightSnapshot[] }>("/api/data/insights?all=true");
    return data.insights;
  } catch (error) {
    logStorageFallback("insights-load", error);
    return [];
  }
}

export async function loadSyncRunsData(): Promise<InstagramSyncRun[]> {
  try {
    const data = await requestStorageJson<{ syncRuns: InstagramSyncRun[] }>("/api/data/sync-runs");
    return data.syncRuns;
  } catch (error) {
    logStorageFallback("sync-runs-load", error);
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
    logStorageFallback("analysis-save", error);
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
    logStorageFallback("reports-load", error);
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
    logStorageFallback("report-save", error);
    return null;
  }
}
