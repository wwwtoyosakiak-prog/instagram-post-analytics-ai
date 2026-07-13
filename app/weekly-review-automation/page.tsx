"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  automationStatusLabel,
  type WeeklyReviewRun,
} from "@/lib/weekly-review-automation";

export default function WeeklyReviewAutomationPage() {
  const [runs, setRuns] = useState<WeeklyReviewRun[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRuns() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/weekly-review-automation-runs",
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "実行履歴を取得できませんでした。",
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
    if (!secret.trim()) {
      setError(
        "手動実行にはCRON_SECRETの入力が必要です。",
      );
      return;
    }

    setRunning(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/cron/weekly-operation-review?manual=1",
        {
          headers: {
            Authorization: `Bearer ${secret.trim()}`,
          },
          cache: "no-store",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "手動実行に失敗しました。",
        );
      }

      setMessage(
        data.status === "skipped"
          ? "対象データがないためスキップされました。"
          : "週次レビューを生成・保存しました。",
      );
      await loadRuns();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "手動実行に失敗しました。",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="週次レビュー自動化"
        description="毎週の数値レビューとAIレビューを自動生成し、実行結果を確認します。"
      />

      <Panel className="mb-6">
        <p className="text-sm leading-6 text-stone-600">
          Vercel Cronは毎週月曜9時10分ごろ（日本時間）に実行されます。対象は直前の月曜〜日曜です。
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="password"
            value={secret}
            onChange={(event) =>
              setSecret(event.target.value)
            }
            placeholder="手動実行用CRON_SECRET"
          />
          <Button
            onClick={() => void runManually()}
            disabled={running}
          >
            {running ? "実行中..." : "今すぐ実行"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/weekly-operation-review"
            className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            数値レビュー
          </Link>
          <Link
            href="/weekly-operation-review-ai-history"
            className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            AI週次履歴
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {message ? (
        <Panel className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">
            {message}
          </p>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">実行履歴</h2>
          <Button
            onClick={() => void loadRuns()}
            disabled={loading}
          >
            更新
          </Button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">
            読み込み中...
          </p>
        ) : runs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-stone-500">
                  <th className="px-3 py-3">開始</th>
                  <th className="px-3 py-3">実行方法</th>
                  <th className="px-3 py-3">状態</th>
                  <th className="px-3 py-3">対象週</th>
                  <th className="px-3 py-3">モデル</th>
                  <th className="px-3 py-3">メッセージ</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-stone-100"
                  >
                    <td className="px-3 py-3">
                      {new Date(
                        run.startedAt,
                      ).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-3">
                      {run.triggerType === "cron"
                        ? "自動"
                        : "手動"}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {automationStatusLabel(
                        run.status,
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {run.targetWeekStart &&
                      run.targetWeekEnd
                        ? `${run.targetWeekStart}〜${run.targetWeekEnd}`
                        : "未確定"}
                    </td>
                    <td className="px-3 py-3">
                      {run.aiModel || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {run.message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-500">
            実行履歴はまだありません。
          </p>
        )}
      </Panel>
    </div>
  );
}
