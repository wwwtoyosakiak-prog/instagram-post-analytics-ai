"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAllInsightData,
  loadAnalysesData,
  loadPostsData,
  loadSyncRunsData,
} from "@/lib/cloud-storage";
import type {
  InstagramInsightSnapshot,
  InstagramPost,
  InstagramSyncRun,
} from "@/lib/types";
import type { ApiMedia } from "@/lib/post-merge";
import type {
  DashboardAccount,
  DashboardAccountInsightTrendRow,
  DashboardApiResponse,
} from "@/components/dashboard/types";
import { toTokyoDateHour } from "@/components/dashboard/utils";
import { requestJsonOr } from "@/lib/client-api";

export function useDashboardData() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [insightHistory, setInsightHistory] = useState<InstagramInsightSnapshot[]>([]);
  const [insightDate, setInsightDate] = useState("");
  const [syncRuns, setSyncRuns] = useState<InstagramSyncRun[]>([]);
  const [apiMedia, setApiMedia] = useState<ApiMedia[]>([]);
  const [dashAccount, setDashAccount] = useState<DashboardAccount | null>(null);
  const [accountInsightsTrend, setAccountInsightsTrend] = useState<DashboardAccountInsightTrendRow[]>([]);
  const [apiConnectionMessage, setApiConnectionMessage] = useState("Instagram連携を確認中...");

  const refreshDashboard = useCallback(async () => {
    const [loadedPosts, loadedInsights, loadedSyncRuns] = await Promise.all([
      loadPostsData(),
      loadAllInsightData(),
      loadSyncRunsData(),
    ]);
    setPosts(loadedPosts);
    setInsightHistory(loadedInsights);
    setSyncRuns(loadedSyncRuns);

    const latestInsight = [...loadedInsights].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    )[0];
    if (latestInsight) setInsightDate(toTokyoDateHour(latestInsight.capturedAt).date);

    void Promise.all(
      loadedPosts.map(async (post) => [post.id, (await loadAnalysesData(post.id))[0]?.score] as const),
    );
  }, []);

  const refreshApiData = useCallback(async () => {
    try {
      const [mediaResponse, dashboardResponse] = await Promise.all([
        requestJsonOr<{ data: ApiMedia[] }>("/api/instagram/media?limit=200", { data: [] }),
        requestJsonOr<DashboardApiResponse | null>("/api/instagram/dashboard", null),
      ]);
      setApiMedia(mediaResponse.data ?? []);
      const dashboard = dashboardResponse;
      setDashAccount(dashboard?.account ?? null);
      setAccountInsightsTrend(dashboard?.account_insights_trend ?? []);
      setApiConnectionMessage(
        dashboard?.configured === false
          ? dashboard.message ?? "Instagramデータベースが未接続です。"
          : dashboard?.account
            ? ""
            : "Instagramデータはまだありません。同期してください。",
      );
    } catch {
      setApiConnectionMessage("Instagramデータを取得できませんでした。しばらくしてから再度お試しください。");
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
    void refreshApiData();
  }, [refreshApiData, refreshDashboard]);

  return {
    posts,
    insightHistory,
    insightDate,
    setInsightDate,
    syncRuns,
    apiMedia,
    dashAccount,
    accountInsightsTrend,
    apiConnectionMessage,
    refreshDashboard,
    refreshApiData,
  };
}
