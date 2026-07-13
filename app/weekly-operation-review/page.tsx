"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type { WeeklyOperationReview } from "@/lib/weekly-operation-review";

export default function WeeklyOperationReviewPage() {
  const [review, setReview] =
    useState<WeeklyOperationReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadReview() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-manager/weekly-review",
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok || !data.review) {
        throw new Error(
          data.error ??
            "週間レビューを作成できませんでした。",
        );
      }

      setReview(data.review);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "週間レビューを作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReview();
  }, []);

  async function saveReview() {
    if (!review) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-manager/weekly-review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ review }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "週間レビューを保存できませんでした。",
        );
      }

      setMessage("週間レビューを保存しました。");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "週間レビューを保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="週次運用レビュー"
        description="1週間のスコアとタスク達成状況を振り返り、来週の重点課題を決めます。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            日次記録をもとに自動集計します。記録日数が少ない週は暫定評価として扱います。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void loadReview()}
              disabled={loading}
            >
              {loading ? "集計中..." : "再集計"}
            </Button>
            <Button
              onClick={() => void saveReview()}
              disabled={saving || !review}
            >
              {saving ? "保存中..." : "週間レビューを保存"}
            </Button>
            <Link
              href="/ai-manager-history"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              日次履歴
            </Link>
          </div>
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

      {loading ? (
        <Panel>
          <p className="text-sm text-stone-500">
            週間データを集計中...
          </p>
        </Panel>
      ) : !review ? (
        <Panel>
          <p className="text-sm text-stone-600">
            レビュー結果がありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <p className="text-sm text-stone-500">
              対象期間
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {review.weekStart} 〜 {review.weekEnd}
            </h2>
            <p className="mt-2 text-sm">
              記録日数：{review.daysRecorded}日
            </p>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Metric
              label="総合"
              value={review.averages.totalScore}
              change={
                review.previousWeekChange?.totalScore
              }
            />
            <Metric
              label="予定管理"
              value={review.averages.scheduleScore}
              change={
                review.previousWeekChange?.scheduleScore
              }
            />
            <Metric
              label="投稿準備"
              value={review.averages.preparationScore}
              change={
                review.previousWeekChange
                  ?.preparationScore
              }
            />
            <Metric
              label="継続性"
              value={review.averages.consistencyScore}
              change={
                review.previousWeekChange
                  ?.consistencyScore
              }
            />
            <Metric
              label="成長"
              value={review.averages.growthScore}
              change={
                review.previousWeekChange?.growthScore
              }
            />
            <Metric
              label="達成率"
              value={review.averages.completionRate}
              suffix="%"
              change={
                review.previousWeekChange
                  ?.completionRate
              }
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              週間タスク
            </h2>
            <p className="mt-3 text-3xl font-bold">
              {review.tasks.completed}/
              {review.tasks.total}
            </p>
            <p className="mt-2 text-sm text-stone-600">
              未完了 {review.tasks.remaining}件
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                改善した指標
              </h2>
              <ItemList
                items={review.improvedMetrics}
                empty="前週から改善した指標はありません。"
              />
            </Panel>
            <Panel>
              <h2 className="font-semibold">
                悪化した指標
              </h2>
              <ItemList
                items={review.declinedMetrics}
                empty="前週から悪化した指標はありません。"
              />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                今週の強み
              </h2>
              <ItemList
                items={review.strengths}
                empty="強みを判断できる記録が不足しています。"
              />
            </Panel>
            <Panel>
              <h2 className="font-semibold">
                注意点
              </h2>
              <ItemList
                items={review.concerns}
                empty="大きな注意点はありません。"
              />
            </Panel>
          </div>

          <Panel className="border-sky-200 bg-sky-50">
            <h2 className="font-semibold">
              来週の重点課題
            </h2>
            <ItemList
              items={review.nextWeekPriorities}
              empty="現状の運用を維持してください。"
            />
          </Panel>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "点",
  change,
}: {
  label: string;
  value: number;
  suffix?: string;
  change?: number;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">
        {value}
        {suffix}
      </p>
      {change !== undefined ? (
        <p
          className={`mt-2 text-xs font-semibold ${
            change > 0
              ? "text-emerald-700"
              : change < 0
                ? "text-red-600"
                : "text-stone-500"
          }`}
        >
          前週比 {change > 0 ? "+" : ""}
          {change}
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
    <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
      {items.length ? (
        items.map((item) => (
          <li key={item}>・{item}</li>
        ))
      ) : (
        <li>{empty}</li>
      )}
    </ul>
  );
}
