"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ActionError, Button, PageHeader, Panel, Stat } from "@/components/ui";
import { InstagramAccessTokenRecord, InstagramOperationLog } from "@/lib/types";
import { requestJson } from "@/lib/client-api";
import { toUserFacingError } from "@/lib/user-facing-error";

type RefreshResponse = {
  ok: boolean;
  refreshed: boolean;
  skipped?: boolean;
  message: string;
  token?: InstagramAccessTokenRecord;
};

type SetupStatus = {
  oauthConfigured: boolean;
  connectionReady: boolean;
  databaseReady: boolean;
  deletionTableReady: boolean;
  duplicateProtectionReady: boolean;
};

const statusLabels: Record<InstagramAccessTokenRecord["status"], string> = {
  missing: "未設定",
  environment_only: "初回更新待ち",
  active: "正常",
  expiring_soon: "期限が近い",
  expired: "期限切れ",
  refresh_failed: "更新失敗"
};

const warningStyles: Record<InstagramAccessTokenRecord["warningLevel"], string> = {
  normal: "",
  warning_30_days: "border border-amber-200 bg-amber-50 text-amber-900",
  danger_7_days: "border border-red-200 bg-red-50 text-red-900",
  expired: "border border-red-300 bg-red-50 text-red-900"
};

const logTypeLabels: Record<string, string> = {
  manual_refresh: "手動更新",
  scheduled_refresh: "自動更新",
  status_check: "状態確認",
  cron_run: "Cron"
};

const logResultLabels: Record<InstagramOperationLog["result"], string> = {
  success: "成功",
  failed: "失敗",
  skipped: "スキップ"
};

function formatDateTime(value?: string | null, emptyText = "未設定") {
  if (!value) return emptyText;
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function getRemainingDaysLabel(token: InstagramAccessTokenRecord | null) {
  if (!token) return "読込中";
  if (token.daysRemaining != null) return `${token.daysRemaining}日`;
  if (token.status === "environment_only") return "初回更新待ち";
  if (token.status === "missing") return "未設定";
  return "更新後に表示";
}

function getNextRefreshLabel(token: InstagramAccessTokenRecord | null) {
  if (!token) return "読込中";
  if (token.nextRefreshAt) return formatDateTime(token.nextRefreshAt, "未設定");
  if (token.status === "environment_only") return "初回更新後に計算";
  if (token.status === "missing") return "未設定";
  return "更新後に計算";
}

function getWarningMessage(token: InstagramAccessTokenRecord | null) {
  if (!token) return "";
  if (token.warningLevel === "danger_7_days") {
    return "トークンの有効期限が7日未満です。早急に更新してください。";
  }
  if (token.warningLevel === "warning_30_days") {
    return "トークンの有効期限が30日未満です。自動更新対象です。";
  }
  if (token.warningLevel === "expired") {
    return "トークン期限切れです。再ログインして長期トークンを再取得してください。";
  }
  return "";
}

function getResultBadgeClass(result: InstagramOperationLog["result"]) {
  if (result === "success") return "bg-emerald-50 text-emerald-700";
  if (result === "skipped") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function getOperationLabel(operationType: string) {
  return logTypeLabels[operationType] ?? operationType;
}

export default function TokenManagementPage() {
  const [token, setToken] = useState<InstagramAccessTokenRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestMessage, setConnectionTestMessage] = useState("");

  const loadStatus = async (mode: "initial" | "check" = "initial") => {
    if (mode === "check") {
      setChecking(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const [data, setup] = await Promise.all([
        requestJson<InstagramAccessTokenRecord>("/api/instagram/token/status", { cache: "no-store" }, "トークン状態の取得に失敗しました。"),
        requestJson<SetupStatus>("/api/instagram/setup-status", { cache: "no-store" }, "連携準備状況を取得できませんでした。"),
      ]);
      setToken(data);
      setSetupStatus(setup);
      if (mode === "check") {
        setMessage("最新のトークン状態を確認しました。");
      }
    } catch (caught) {
      setError(toUserFacingError(caught, "token"));
    } finally {
      setLoading(false);
      setChecking(false);
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
      const data = await requestJson<RefreshResponse>(
        "/api/instagram/token/refresh",
        { method: "POST" },
        "トークン更新に失敗しました。",
      );
      if (!data.ok && !data.skipped) throw new Error(data.message || "トークン更新に失敗しました。");
      if (data.token) setToken(data.token);
      setMessage(data.message);
      await loadStatus();
    } catch (caught) {
      setError(toUserFacingError(caught, "token"));
      await loadStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const warningMessage = useMemo(() => getWarningMessage(token), [token]);
  const connected = Boolean(token && token.status !== "missing");

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionTestMessage("");
    setError("");
    try {
      const result = await requestJson<{ ok: boolean; message: string }>("/api/instagram/setup-status", { method: "POST" }, "Instagram接続テストに失敗しました。");
      setConnectionTestMessage(result.message);
      await loadStatus();
    } catch (caught) {
      setError(toUserFacingError(caught, "token"));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="トークン管理"
        description="Instagram長期アクセストークンの状態確認、手動更新、Cron実行履歴の確認ができます。トークン本体は画面に表示しません。"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => { void loadStatus("check"); }} disabled={checking || refreshing || loading} variant="secondary">
              {checking ? "確認中..." : "今すぐ状態確認"}
            </Button>
            <Button onClick={() => { void refreshToken(); }} disabled={refreshing || checking || loading}>
              {refreshing ? "更新中..." : "手動更新"}
            </Button>
          </div>
        }
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="mr-auto">
            <h2 className="font-semibold">Instagramアカウント接続</h2>
            <p className="mt-1 text-sm text-stone-600">各ユーザーが自分のInstagramで認証します。アクセストークンを手入力する必要はありません。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? <Button type="button" variant="secondary" onClick={() => { void testConnection(); }} disabled={testingConnection}>{testingConnection ? "確認中..." : "接続テスト"}</Button> : null}
            {connected ? <button type="button" className="btn-secondary" onClick={async () => { if (!window.confirm("Instagram連携を解除しますか？")) return; await fetch("/api/instagram/oauth/disconnect", { method: "POST" }); await loadStatus(); }}>連携を解除</button>
              : <a className="btn-primary" href="/api/instagram/oauth/start">Instagramと連携</a>}
          </div>
        </div>
        {connectionTestMessage ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{connectionTestMessage}</p> : null}
      </Panel>

      <Panel className="mb-6">
        <h2 className="font-semibold">運用準備チェック</h2>
        <p className="mt-1 text-sm text-stone-600">接続からデータ保護まで、必要な準備をまとめて確認します。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ReadinessItem ready={setupStatus?.oauthConfigured} label="Meta OAuth設定" pending="VercelのInstagramアプリ設定を確認してください" />
          <ReadinessItem ready={setupStatus?.connectionReady} label="ユーザー別Instagram連携" pending="「Instagramと連携」から接続してください" />
          <ReadinessItem ready={setupStatus?.databaseReady} label="Supabase保存先" pending="Supabase環境設定を確認してください" />
          <ReadinessItem ready={setupStatus?.deletionTableReady} label="Metaデータ削除受付" pending="add-instagram-data-deletion.sql を実行してください" />
          <ReadinessItem ready={setupStatus?.duplicateProtectionReady} label="プロフィール重複防止" pending="add-account-identity-protection.sql を実行してください" />
        </div>
      </Panel>

      {token?.warningLevel === "danger_7_days" || token?.warningLevel === "expired" ? (
        <div className={`mb-5 rounded-lg px-4 py-4 text-sm font-medium ${warningStyles[token.warningLevel]}`}>
          {warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="トークン状態" value={token ? statusLabels[token.status] : "読込中"} />
        <Stat label="残り日数" value={getRemainingDaysLabel(token)} />
        <Stat label="次回更新予定" value={getNextRefreshLabel(token)} />
        <Stat label="保存元" value={token?.source === "database" ? "DB" : token?.source === "environment" ? "環境変数" : "未設定"} />
      </div>

      <Panel className="mt-6">
        <h2 className="font-semibold">現在の管理情報</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="トークン表示">{token?.maskedToken ?? "未設定"}</Field>
          <Field label="更新可能">{token ? (token.canRefresh ? "はい" : "いいえ") : "確認中"}</Field>
          <Field label="更新理由">{token?.refreshReason ?? "確認中"}</Field>
          <Field label="有効期限">{formatDateTime(token?.expiresAt)}</Field>
          <Field label="発行日時">{formatDateTime(token?.issuedAt)}</Field>
          <Field label="最終更新日時">{formatDateTime(token?.lastRefreshedAt)}</Field>
          <Field label="最終確認日時">{formatDateTime(token?.lastCheckedAt)}</Field>
          <Field label="次回Cron予定">{formatDateTime(token?.nextCronRunAt)}</Field>
          <Field label="最終Cron実行">{formatDateTime(token?.lastCronRunAt)}</Field>
          <Field label="最終Cron結果">{token?.lastCronResult ? logResultLabels[token.lastCronResult] : "未実行"}</Field>
          <Field label="最終Cronメッセージ">{token?.lastCronMessage ?? "未記録"}</Field>
          <Field label="Cronエラー">{token?.lastCronError ?? "なし"}</Field>
        </div>

        {token?.warningLevel === "warning_30_days" ? (
          <div className={`mt-5 rounded-md px-4 py-3 text-sm ${warningStyles[token.warningLevel]}`}>
            {warningMessage}
          </div>
        ) : null}

        {!loading && token?.refreshBlockedReason && token.refreshBlockedReason !== token.refreshReason ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {token.refreshBlockedReason}
          </div>
        ) : null}

        {!loading && token?.lastError ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">最終エラー</p>
            <p className="mt-1">{toUserFacingError(token.lastError, "token")}</p>
          </div>
        ) : null}

        {message ? <p className="mt-4 rounded-md bg-skyglass px-4 py-3 text-sm text-ink">{message}</p> : null}
        {error ? <ActionError message={error} actionLabel="もう一度確認" onAction={() => { void loadStatus("check"); }} className="mt-4" /> : null}
      </Panel>

      <Panel className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">更新履歴</h2>
            <p className="mt-1 text-sm text-stone-600">新しい履歴が上に表示されます。</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <caption className="sr-only">Instagramトークンの更新履歴</caption>
            <thead>
              <tr className="text-left text-stone-500">
                <th className="px-3 py-2">実行日時</th>
                <th className="px-3 py-2">実行種別</th>
                <th className="px-3 py-2">結果</th>
                <th className="px-3 py-2">メッセージ</th>
                <th className="px-3 py-2">エラー内容</th>
              </tr>
            </thead>
            <tbody>
              {token?.recentLogs?.length ? token.recentLogs.map((log) => (
                <tr key={log.id} className="rounded-lg bg-white/70 shadow-soft">
                  <td className="rounded-l-lg px-3 py-3 align-top text-ink">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-3 align-top text-ink">{getOperationLabel(log.operationType)}</td>
                  <td className="px-3 py-3 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getResultBadgeClass(log.result)}`}>
                      {logResultLabels[log.result]}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-ink">{log.message || "-"}</td>
                  <td className="rounded-r-lg px-3 py-3 align-top text-stone-600">{log.errorDetail || "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-stone-500">履歴はまだありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ReadinessItem({ ready, label, pending }: { ready?: boolean; label: string; pending: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`font-semibold ${ready ? "text-emerald-800" : "text-amber-900"}`}>{ready ? "✓" : "!"} {label}</p>
      <p className={`mt-1 text-xs ${ready ? "text-emerald-700" : "text-amber-800"}`}>{ready ? "準備完了" : pending}</p>
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
