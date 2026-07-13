"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import {
  compareAiWeeklyReviews,
  type AiWeeklyReviewHistoryItem,
} from "@/lib/ai-weekly-review-history";

export default function AiWeeklyReviewHistoryPage() {
  const [items, setItems] = useState<
    AiWeeklyReviewHistoryItem[]
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/ai-manager/weekly-review/ai-history",
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "AI週次レビュー履歴を取得できませんでした。",
          );
        }

        const loadedItems = data.items ?? [];
        setItems(loadedItems);

        if (loadedItems[0]?.id) {
          setSelectedId(loadedItems[0].id);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "AI週次レビュー履歴を取得できませんでした。",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const selectedIndex = items.findIndex(
    (item) => item.id === selectedId,
  );
  const current =
    selectedIndex >= 0 ? items[selectedIndex] : null;
  const previous =
    selectedIndex >= 0
      ? items[selectedIndex + 1] ?? null
      : null;

  const comparison = useMemo(
    () =>
      current
        ? compareAiWeeklyReviews(current, previous)
        : null,
    [current, previous],
  );

  return (
    <div>
      <PageHeader
        title="AI週次レビュー履歴"
        description="過去のAI助言と重点課題の変化を確認します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-72 flex-1">
            <label>確認する週</label>
            <select
              className="mt-1"
              value={selectedId}
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
            >
              <option value="">選択してください</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.weekStart}〜{item.weekEnd}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/weekly-operation-review-ai"
            className="inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
          >
            AI週次レビュー
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
      ) : !current || !comparison ? (
        <Panel>
          <p className="text-sm text-stone-600">
            保存されたAI週次レビューはありません。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="対象週"
              value={`${current.weekStart}〜${current.weekEnd}`}
            />
            <Metric
              label="使用モデル"
              value={current.aiModel || "記録なし"}
            />
            <Metric
              label="生成日時"
              value={
                current.aiGeneratedAt
                  ? new Date(
                      current.aiGeneratedAt,
                    ).toLocaleString("ja-JP")
                  : "記録なし"
              }
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              今週の総評
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
              {current.aiReview.executiveSummary}
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                今回の最優先課題
              </h2>
              <p className="mt-3 text-xl font-bold">
                {comparison.currentPriority}
              </p>
            </Panel>

            <Panel>
              <h2 className="font-semibold">
                前回の最優先課題
              </h2>
              <p className="mt-3 text-xl font-bold">
                {comparison.previousPriority ??
                  "前回データなし"}
              </p>
              {comparison.repeatedPriority ? (
                <p className="mt-3 text-sm font-semibold text-amber-700">
                  前回と同じ課題が継続しています。
                </p>
              ) : null}
            </Panel>
          </div>

          <Panel>
            <h2 className="font-semibold">
              7日間の行動計画
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {current.aiReview.actionPlan.map(
                (item, index) => (
                  <div
                    key={`${item.day}-${index}`}
                    className="rounded-lg border border-stone-200 bg-white p-5"
                  >
                    <p className="text-xs font-semibold text-stone-500">
                      {item.day}
                    </p>
                    <h3 className="mt-2 font-bold">
                      {item.action}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {item.purpose}
                    </p>
                  </div>
                ),
              )}
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
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-5">
      <p className="text-xs font-semibold text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold">
        {value}
      </p>
    </div>
  );
}
