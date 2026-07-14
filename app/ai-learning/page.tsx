"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  AiLearningMemory,
  AiLearningStats,
} from "@/lib/ai-learning";
import type {
  ImprovementCycle,
} from "@/lib/ai-improvement-cycle";

export default function AiLearningPage() {
  const [memories, setMemories] = useState<
    AiLearningMemory[]
  >([]);
  const [stats, setStats] =
    useState<AiLearningStats | null>(null);
  const [cycles, setCycles] = useState<ImprovementCycle[]>(
    [],
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] =
    useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [memoryResponse, cycleResponse] =
        await Promise.all([
          fetch("/api/ai-learning", {
            cache: "no-store",
          }),
          fetch("/api/ai-improvement-cycles", {
            cache: "no-store",
          }),
        ]);

      const memoryData = await memoryResponse.json();
      const cycleData = await cycleResponse.json();

      if (!memoryResponse.ok) {
        throw new Error(
          memoryData.error ??
            "AI学習データを取得できませんでした。",
        );
      }

      if (!cycleResponse.ok) {
        throw new Error(
          cycleData.error ??
            "改善サイクルを取得できませんでした。",
        );
      }

      setMemories(memoryData.memories ?? []);
      setStats(memoryData.stats ?? null);
      setCycles(cycleData.cycles ?? []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "データを取得できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const learnedCycleIds = useMemo(
    () =>
      new Set(
        memories
          .map((memory) => memory.improvementCycleId)
          .filter(
            (value): value is string =>
              typeof value === "string",
          ),
      ),
    [memories],
  );

  const learnableCycles = cycles.filter(
    (cycle) =>
      ["continue", "adjust", "stop"].includes(
        cycle.status,
      ) && !learnedCycleIds.has(cycle.id),
  );

  const filteredMemories = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return memories;

    return memories.filter((memory) =>
      [
        memory.title,
        memory.hypothesis,
        memory.action,
        memory.metricName,
        memory.learningSummary,
        ...memory.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [memories, query]);

  const successRanking = useMemo(
    () =>
      memories
        .filter(
          (memory) =>
            memory.outcome === "success" &&
            memory.improvementRate !== null,
        )
        .sort(
          (a, b) =>
            (b.improvementRate ?? 0) -
            (a.improvementRate ?? 0),
        )
        .slice(0, 5),
    [memories],
  );

  async function learnCycle(cycle: ImprovementCycle) {
    setSavingId(cycle.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-learning",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            improvementCycleId: cycle.id,
            title: cycle.title,
            hypothesis: cycle.hypothesis,
            action: cycle.action,
            metricName: cycle.metricName,
            baselineValue: cycle.baselineValue,
            targetValue: cycle.targetValue,
            resultValue: cycle.resultValue,
            status: cycle.status,
            evaluation: cycle.evaluation,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "学習データを保存できませんでした。",
        );
      }

      setMessage(
        `「${cycle.title}」をAI学習データへ追加しました。`,
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "学習データを保存できませんでした。",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI改善学習"
        description="改善サイクルの成功・失敗を蓄積し、次回のAI提案へ活用します。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            評価済みの改善サイクルを学習データへ追加してください。同じサイクルは重複登録されません。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void load()}
              disabled={loading}
            >
              更新
            </Button>
            <Link
              href="/ai-improvement-cycle"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              改善サイクル
            </Link>
            <Link
              href="/ai-improvement-suggestions"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              AI改善案
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
            学習データを集計中...
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              label="学習件数"
              value={`${stats?.total ?? 0}件`}
            />
            <Metric
              label="成功"
              value={`${stats?.success ?? 0}件`}
            />
            <Metric
              label="一部成功"
              value={`${stats?.partial ?? 0}件`}
            />
            <Metric
              label="失敗"
              value={`${stats?.failure ?? 0}件`}
            />
            <Metric
              label="成功率"
              value={`${stats?.successRate ?? 0}%`}
            />
          </div>

          {learnableCycles.length ? (
            <Panel className="border-amber-200 bg-amber-50">
              <h2 className="font-semibold">
                未学習の評価済みサイクル
              </h2>
              <div className="mt-4 space-y-3">
                {learnableCycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-white p-4"
                  >
                    <div>
                      <h3 className="font-bold">
                        {cycle.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">
                        {cycle.metricName}：
                        {cycle.baselineValue ?? "未設定"} →
                        {cycle.resultValue ?? "未設定"}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        void learnCycle(cycle)
                      }
                      disabled={savingId === cycle.id}
                    >
                      {savingId === cycle.id
                        ? "学習中..."
                        : "AIに学習させる"}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                成功施策ランキング
              </h2>
              <div className="mt-4 space-y-3">
                {successRanking.length ? (
                  successRanking.map(
                    (memory, index) => (
                      <div
                        key={memory.id}
                        className="rounded-lg border border-stone-200 bg-white p-4"
                      >
                        <p className="text-xs font-semibold text-stone-500">
                          第{index + 1}位
                        </p>
                        <h3 className="mt-2 font-bold">
                          {memory.title}
                        </h3>
                        <p className="mt-2 text-sm">
                          目標達成率：
                          {memory.improvementRate}%
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-stone-500">
                    成功データはまだありません。
                  </p>
                )}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-semibold">
                平均目標達成率
              </h2>
              <p className="mt-4 text-4xl font-bold">
                {stats?.averageImprovementRate ??
                  "—"}
                {stats?.averageImprovementRate !== null
                  ? "%"
                  : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                基準値・目標値・結果値が揃った施策だけを集計しています。
              </p>
            </Panel>
          </div>

          <Panel>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold">
                  AIが覚えている改善知識
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  テーマ・KPI・施策で絞り込めます。
                </p>
              </div>
              <input
                className="max-w-sm"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="例：保存率、リール、冒頭"
              />
            </div>

            <div className="mt-5 space-y-4">
              {filteredMemories.length ? (
                filteredMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                  />
                ))
              ) : (
                <p className="text-sm text-stone-500">
                  該当する学習データはありません。
                </p>
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
      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

function MemoryCard({
  memory,
}: {
  memory: AiLearningMemory;
}) {
  const label =
    memory.outcome === "success"
      ? "成功"
      : memory.outcome === "partial"
        ? "一部成功"
        : memory.outcome === "failure"
          ? "失敗"
          : "未判定";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            {memory.title}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {memory.metricName}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
          {label}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-stone-700">
        {memory.learningSummary}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {memory.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
