"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  aiAgentStatusLabel,
  aiAgentStepStatusLabel,
  type AiAgentRun,
} from "@/lib/ai-agent";

export default function AiAgentPage() {
  const [runs, setRuns] = useState<AiAgentRun[]>([]);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRuns() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ai-agent/runs",
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "AIエージェント履歴を取得できませんでした。",
        );
      }

      setRuns(data.runs ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AIエージェント履歴を取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  const latest = runs[0] ?? null;

  const successRate = useMemo(() => {
    if (!runs.length) return 0;

    const success = runs.filter(
      (run) => run.status === "success",
    ).length;

    return Math.round(
      (success / runs.length) * 100,
    );
  }, [runs]);

  async function runAgent() {
    if (!secret.trim()) {
      setError("CRON_SECRETを入力してください。");
      return;
    }

    setRunning(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-agent/run",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret.trim()}`,
          },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "AIエージェントを実行できませんでした。",
        );
      }

      setMessage(data.message ?? "実行が完了しました。");
      await loadRuns();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AIエージェントを実行できませんでした。",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI運用エージェント"
        description="既存の同期・週次レビュー・通知処理を、安全な順序でまとめて実行します。"
      />

      <Panel className="mb-6">
        <p className="text-sm leading-6 text-stone-600">
          必須工程が失敗した場合、後続工程はスキップします。自動投稿やアカウント設定変更は行いません。
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="password"
            value={secret}
            onChange={(event) =>
              setSecret(event.target.value)
            }
            placeholder="CRON_SECRET"
          />
          <Button
            onClick={() => void runAgent()}
            disabled={running}
          >
            {running
              ? "AIエージェント実行中..."
              : "今すぐ実行"}
          </Button>
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="総実行回数"
          value={`${runs.length}回`}
        />
        <Metric
          label="成功率"
          value={`${successRate}%`}
        />
        <Metric
          label="最終状態"
          value={
            latest
              ? aiAgentStatusLabel(latest.status)
              : "未実行"
          }
        />
        <Metric
          label="最終処理時間"
          value={
            latest?.durationMs !== null &&
            latest?.durationMs !== undefined
              ? `${(
                  latest.durationMs / 1000
                ).toFixed(1)}秒`
              : "—"
          }
        />
      </div>

      {latest ? (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-500">
                最新実行
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {aiAgentStatusLabel(latest.status)}
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                {new Date(
                  latest.startedAt,
                ).toLocaleString("ja-JP")}
              </p>
            </div>
            <Button
              onClick={() => void loadRuns()}
              disabled={loading}
            >
              更新
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {latest.steps.map((step) => (
              <div
                key={step.key}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold">
                    {step.label}
                  </h3>
                  <span className="text-xs font-semibold">
                    {aiAgentStepStatusLabel(
                      step.status,
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {step.message || "メッセージなし"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="font-semibold">実行履歴</h2>

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
                  <th className="px-3 py-3">方法</th>
                  <th className="px-3 py-3">状態</th>
                  <th className="px-3 py-3">成功</th>
                  <th className="px-3 py-3">失敗</th>
                  <th className="px-3 py-3">スキップ</th>
                  <th className="px-3 py-3">時間</th>
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
                      {aiAgentStatusLabel(run.status)}
                    </td>
                    <td className="px-3 py-3">
                      {run.completedSteps}
                    </td>
                    <td className="px-3 py-3">
                      {run.failedSteps}
                    </td>
                    <td className="px-3 py-3">
                      {run.skippedSteps}
                    </td>
                    <td className="px-3 py-3">
                      {run.durationMs === null
                        ? "—"
                        : `${(
                            run.durationMs / 1000
                          ).toFixed(1)}秒`}
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}
