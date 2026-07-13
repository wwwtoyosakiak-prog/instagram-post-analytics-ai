"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import {
  calculateOperationStreak,
  type ManagerDailySnapshot,
} from "@/lib/ai-manager-history";

export default function AiManagerHistoryPage() {
  const [snapshots, setSnapshots] = useState<
    ManagerDailySnapshot[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/ai-manager/history",
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "運用履歴を取得できませんでした。",
          );
        }

        setSnapshots(data.snapshots ?? []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "運用履歴を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const streak = useMemo(
    () => calculateOperationStreak(snapshots, today),
    [snapshots, today],
  );

  const current = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  return (
    <div>
      <PageHeader
        title="AI運用マネージャー履歴"
        description="毎日の運用スコアとタスク達成率を確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            毎日の記録を残すことで、提案を見るだけでなく実際の運用継続を確認できます。
          </p>
          <Link
            href="/ai-manager"
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            今日の運用管理
          </Link>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">
            読み込み中...
          </p>
        </Panel>
      ) : !current ? (
        <Panel>
          <p className="text-sm text-stone-600">
            日次記録はまだありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="最新運用スコア"
              value={`${current.totalScore}点`}
              difference={
                previous
                  ? current.totalScore -
                    previous.totalScore
                  : undefined
              }
            />
            <Metric
              label="最新達成率"
              value={`${current.completionRate}%`}
              difference={
                previous
                  ? current.completionRate -
                    previous.completionRate
                  : undefined
              }
            />
            <Metric
              label="完了タスク"
              value={`${current.completedTasks}/${current.totalTasks}`}
            />
            <Metric
              label="連続運用"
              value={`${streak}日`}
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              運用スコアの推移
            </h2>
            <div className="mt-6 flex min-h-64 items-end gap-3 overflow-x-auto">
              {[...snapshots]
                .reverse()
                .map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="flex min-w-20 flex-1 flex-col items-center"
                  >
                    <span className="mb-2 text-sm font-bold">
                      {snapshot.totalScore}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-ink"
                      style={{
                        height: `${Math.max(
                          12,
                          snapshot.totalScore * 2,
                        )}px`,
                      }}
                    />
                    <span className="mt-2 text-xs text-stone-500">
                      {snapshot.snapshotDate.slice(5)}
                    </span>
                  </div>
                ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              日次記録
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-stone-500">
                    <th className="px-3 py-3">日付</th>
                    <th className="px-3 py-3">総合</th>
                    <th className="px-3 py-3">予定</th>
                    <th className="px-3 py-3">準備</th>
                    <th className="px-3 py-3">継続</th>
                    <th className="px-3 py-3">成長</th>
                    <th className="px-3 py-3">タスク</th>
                    <th className="px-3 py-3">達成率</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr
                      key={snapshot.id}
                      className="border-b border-stone-100"
                    >
                      <td className="px-3 py-3">
                        {snapshot.snapshotDate}
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {snapshot.totalScore}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.scheduleScore}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.preparationScore}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.consistencyScore}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.growthScore}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.completedTasks}/
                        {snapshot.totalTasks}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.completionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  difference,
}: {
  label: string;
  value: string;
  difference?: number;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
      {difference !== undefined ? (
        <p
          className={`mt-2 text-xs font-semibold ${
            difference > 0
              ? "text-emerald-700"
              : difference < 0
                ? "text-red-600"
                : "text-stone-500"
          }`}
        >
          前回比 {difference > 0 ? "+" : ""}
          {difference}
        </p>
      ) : null}
    </div>
  );
}
