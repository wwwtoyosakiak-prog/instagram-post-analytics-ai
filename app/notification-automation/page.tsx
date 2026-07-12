"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";

type Run = {
  id: string;
  triggerType: "cron" | "manual";
  status: "running" | "success" | "failed";
  candidateCount: number;
  insertedCount: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export default function NotificationAutomationPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadRuns() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notification-runs", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "実行履歴を取得できませんでした。",
        );
      }

      setRuns(data.runs ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "実行履歴を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  async function runManually() {
    setRunning(true);
    setError("");

    try {
      const response = await fetch(
        "/api/notifications/generate",
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "通知生成に失敗しました。",
        );
      }

      await loadRuns();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "通知生成に失敗しました。",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="通知自動化"
        description="毎朝の自動通知生成と、Cronの実行履歴を確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">
              毎日 08:00（日本時間）
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              投稿予定・準備不足・期限超過を確認し、通知センターへ登録します。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void runManually()}
              disabled={running}
            >
              {running ? "実行中..." : "今すぐ通知を生成"}
            </Button>
            <Link
              href="/notifications"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              通知センター
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="font-semibold">実行履歴</h2>

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">
            読み込み中...
          </p>
        ) : !runs.length ? (
          <p className="mt-4 text-sm text-stone-500">
            実行履歴はまだありません。
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-stone-500">
                  <th className="px-3 py-3">開始日時</th>
                  <th className="px-3 py-3">実行方法</th>
                  <th className="px-3 py-3">状態</th>
                  <th className="px-3 py-3">候補</th>
                  <th className="px-3 py-3">新規登録</th>
                  <th className="px-3 py-3">エラー</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-stone-100"
                  >
                    <td className="px-3 py-3">
                      {new Date(run.startedAt).toLocaleString(
                        "ja-JP",
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {run.triggerType === "cron"
                        ? "自動"
                        : "手動"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-3 py-3">
                      {run.candidateCount}
                    </td>
                    <td className="px-3 py-3">
                      {run.insertedCount}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-red-600">
                      {run.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Run["status"];
}) {
  const label =
    status === "success"
      ? "成功"
      : status === "failed"
        ? "失敗"
        : "実行中";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        status === "success"
          ? "bg-emerald-100 text-emerald-800"
          : status === "failed"
            ? "bg-red-100 text-red-800"
            : "bg-amber-100 text-amber-800"
      }`}
    >
      {label}
    </span>
  );
}
