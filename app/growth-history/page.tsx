"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import {
  calculateGrowthChange,
  filterSnapshotsByDays,
  summarizeGrowthChanges,
  type GrowthSnapshot,
} from "@/lib/growth-history";

type Range = 30 | 90 | 365;

export default function GrowthHistoryPage() {
  const [snapshots, setSnapshots] = useState<GrowthSnapshot[]>([]);
  const [range, setRange] = useState<Range>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/growth-history", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ?? "成長履歴を取得できませんでした。",
          );
        }

        setSnapshots(data.snapshots ?? []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "成長履歴を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const visible = useMemo(
    () => filterSnapshotsByDays(snapshots, range),
    [snapshots, range],
  );

  const current = visible[0] ?? null;
  const previous = visible[1] ?? null;
  const change =
    current && previous
      ? calculateGrowthChange(current, previous)
      : null;
  const summary = summarizeGrowthChanges(change);
  const chartItems = [...visible].reverse();

  return (
    <div>
      <PageHeader
        title="成長戦略の推移"
        description="保存した成長戦略を比較し、本当に改善しているかを確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label>表示期間</label>
            <select
              className="mt-1"
              value={range}
              onChange={(event) =>
                setRange(Number(event.target.value) as Range)
              }
            >
              <option value={30}>過去30日</option>
              <option value={90}>過去90日</option>
              <option value={365}>過去1年</option>
            </select>
          </div>

          <Link
            href="/growth-strategy"
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            成長戦略を確認
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
          <p className="text-sm text-stone-500">読み込み中...</p>
        </Panel>
      ) : !current ? (
        <Panel>
          <p className="text-sm text-stone-600">
            成長戦略の保存履歴はまだありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <MetricCard label="成長スコア" value={`${current.score}/100`} difference={change?.score} />
            <MetricCard label="週あたり投稿" value={`${current.postsPerWeek}本`} difference={change?.postsPerWeek} />
            <MetricCard label="平均表示数" value={current.averageViews.toLocaleString()} difference={change?.averageViews} />
            <MetricCard label="反応率" value={`${current.averageEngagementRate}%`} difference={change?.averageEngagementRate} />
            <MetricCard label="保存率" value={`${current.averageSaveRate}%`} difference={change?.averageSaveRate} />
            <MetricCard label="シェア率" value={`${current.averageShareRate}%`} difference={change?.averageShareRate} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">改善した指標</h2>
              <ItemList
                items={summary.improved}
                empty="前回から改善した指標はありません。"
              />
            </Panel>

            <Panel>
              <h2 className="font-semibold">悪化した指標</h2>
              <ItemList
                items={summary.declined}
                empty="前回から悪化した指標はありません。"
              />
            </Panel>
          </div>

          <Panel>
            <h2 className="font-semibold">成長スコアの推移</h2>
            <div className="mt-6 flex min-h-64 items-end gap-3 overflow-x-auto">
              {chartItems.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex min-w-20 flex-1 flex-col items-center"
                >
                  <span className="mb-2 text-sm font-bold">
                    {snapshot.score}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-ink"
                    style={{
                      height: `${Math.max(
                        12,
                        snapshot.score * 2,
                      )}px`,
                    }}
                  />
                  <span className="mt-2 text-xs text-stone-500">
                    {new Date(snapshot.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">保存履歴</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-stone-500">
                    <th className="px-3 py-3">保存日時</th>
                    <th className="px-3 py-3">スコア</th>
                    <th className="px-3 py-3">投稿数</th>
                    <th className="px-3 py-3">週投稿</th>
                    <th className="px-3 py-3">平均表示</th>
                    <th className="px-3 py-3">保存率</th>
                    <th className="px-3 py-3">シェア率</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((snapshot) => (
                    <tr
                      key={snapshot.id}
                      className="border-b border-stone-100"
                    >
                      <td className="px-3 py-3">
                        {new Date(snapshot.createdAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {snapshot.score}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.postCount}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.postsPerWeek}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.averageViews.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.averageSaveRate}%
                      </td>
                      <td className="px-3 py-3">
                        {snapshot.averageShareRate}%
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

function MetricCard({
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
      <p className="mt-2 text-2xl font-bold">{value}</p>
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

function ItemList({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  return (
    <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
      {items.length ? (
        items.map((item) => <li key={item}>・{item}</li>)
      ) : (
        <li>{empty}</li>
      )}
    </ul>
  );
}
