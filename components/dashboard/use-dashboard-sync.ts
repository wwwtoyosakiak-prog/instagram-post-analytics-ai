"use client";

import { useCallback, useState } from "react";
import { ClientApiError, requestJson } from "@/lib/client-api";
import { toUserFacingError } from "@/lib/user-facing-error";
import { withRetry } from "@/lib/retry";

type RefreshDashboard = () => Promise<void>;

type FullSyncResponse = {
  ok: boolean;
  status?: "success" | "partial" | "failed";
  media_fetched?: number;
  media_saved?: number;
  insights_fetched?: number;
  insights_failed?: number;
  error?: string;
  errors?: string[];
};

export function useDashboardSync(
  refreshApiData: RefreshDashboard,
  refreshDashboard: RefreshDashboard,
) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncErrorMessage, setSyncErrorMessage] = useState("");

  const handleFullSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("同期中...");
    setSyncMessage("");
    setSyncErrorMessage("");

    try {
      const result = await withRetry(
        () => requestJson<FullSyncResponse>(
          "/api/instagram/full-sync",
          { method: "POST" },
          "同期に失敗しました。",
          120_000,
        ),
        {
          attempts: 3,
          shouldRetry: (error) => !(error instanceof ClientApiError) || error.status === 408 || error.status === 429 || error.status >= 500,
          onRetry: (attempt) => setSyncMsg(`通信を再確認しています（${attempt}/3）...`),
        },
      );
      const firstError = result.error ?? result.errors?.[0] ?? "同期に失敗しました。";

      if (result.ok === false) {
        throw new Error(firstError);
      }

      await Promise.all([refreshApiData(), refreshDashboard()]);

      const fetchedPosts = result.media_fetched ?? result.media_saved ?? 0;
      const savedPosts = result.media_saved ?? 0;
      const savedInsights = result.insights_fetched ?? 0;
      const failedInsights = result.insights_failed ?? 0;
      const isPartial = result.status === "partial" || failedInsights > 0;

      setSyncMsg(
        `${isPartial ? "⚠️ 一部完了" : "✅ 同期完了"}: 取得${fetchedPosts}件 / 投稿保存${savedPosts}件 / 履歴保存${savedInsights}件 / 失敗${failedInsights}件`,
      );
      setSyncMessage(
        isPartial
          ? `${savedPosts}件の投稿と${savedInsights}件の履歴を保存しました。一部でエラーがありました。`
          : `${savedPosts}件の投稿と${savedInsights}件の履歴を保存しました。`,
      );
      if (isPartial) setSyncErrorMessage(toUserFacingError(firstError, "sync"));
    } catch (error) {
      setSyncMsg("");
      setSyncErrorMessage(toUserFacingError(error, "sync"));
    } finally {
      setSyncing(false);
    }
  }, [refreshApiData, refreshDashboard]);

  return {
    syncing,
    syncButtonLabel: syncing ? "同期中..." : "Instagramデータを同期",
    syncMsg,
    syncMessage,
    syncErrorMessage,
    handleFullSync,
  };
}
