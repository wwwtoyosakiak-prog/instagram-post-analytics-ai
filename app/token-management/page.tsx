"use client";

import { ReactNode, useEffect, useState } from "react";
import { Button, PageHeader, Panel, Stat } from "@/components/ui";
import { InstagramAccessTokenRecord } from "@/lib/types";

type RefreshResponse = {
  ok: boolean;
  refreshed: boolean;
  skipped?: boolean;
  message: string;
  token?: InstagramAccessTokenRecord;
};

const statusLabels: Record<InstagramAccessTokenRecord["status"], string> = {
  missing: "未設定",
  environment_only: "環境変数のみ",
  active: "正常",
  expiring_soon: "期限が近い",
  expired: "期限切れ",
  refresh_failed: "更新失敗"
};

function formatDateTime(value?: string | null) {
  if (!value) return "未記録";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default function TokenManagementPage() {
  const [token, setToken] = useState<InstagramAccessTokenRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/instagram/token/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "トークン状態の取得に失敗しました。");
      setToken(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "トークン状態の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const refreshToken = async () => {
    setRefreshing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/instagram/token/refresh", { method: "POST" });
      const data = await response.json() as RefreshResponse;
      if (!response.ok || !data.ok) throw new Error(data.message || "トークン更新に失敗しました。");
      if (data.token) setToken(data.token);
      setMessage(data.message);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "トークン更新に失敗しました。");
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="トークン管理"
        description="Instagram長期アクセストークンの状態を確認し、期限切れ前の手動更新を実行できます。トークン本体は画面に表示しません。"
        action={<Button onClick={refreshToken} disabled={refreshing || loading}>{refreshing ? "更新中..." : "手動更新"}</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="トークン状態" value={token ? statusLabels[token.status] : "読込中"} />
        <Stat label="残り日数" value={token?.remainingDays != null ? `${token.remainingDays}日` : "不明"} />
        <Stat label="次回更新予定" value={token?.nextRefreshAt ? formatDateTime(token.nextRefreshAt) : "未計算"} />
        <Stat label="保存元" value={token?.source === "database" ? "DB" : token?.source === "environment" ? "環境変数" : "未設定"} />
      </div>

      <Panel className="mt-6">
        <h2 className="font-semibold">現在の管理情報</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="トークン表示">{token?.maskedToken ?? "未設定"}</Field>
          <Field label="更新可能">{token ? (token.canRefresh ? "はい" : "いいえ") : "確認中"}</Field>
          <Field label="発行日時">{formatDateTime(token?.issuedAt)}</Field>
          <Field label="有効期限">{formatDateTime(token?.expiresAt)}</Field>
          <Field label="最終更新日時">{formatDateTime(token?.lastRefreshedAt)}</Field>
          <Field label="最終確認日時">{formatDateTime(token?.lastCheckedAt)}</Field>
        </div>
        {!loading && token?.refreshBlockedReason ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {token.refreshBlockedReason}
          </div>
        ) : null}
        {!loading && token?.lastError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">最終エラー</p>
            <p className="mt-1 whitespace-pre-wrap">{token.lastError}</p>
          </div>
        ) : null}
        {message ? <p className="mt-4 rounded-md bg-skyglass px-4 py-3 text-sm text-ink">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-2 break-all text-sm text-ink">{children}</p>
    </div>
  );
}
