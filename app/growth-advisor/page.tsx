"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type { GrowthStrategyResult } from "@/lib/growth-strategy";
import type { GrowthAdvisorResult } from "@/lib/growth-advisor";

export default function GrowthAdvisorPage() {
  const [strategy, setStrategy] =
    useState<GrowthStrategyResult | null>(null);
  const [advisor, setAdvisor] =
    useState<GrowthAdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    setAdvisor(null);

    try {
      const postsResponse = await fetch(
        "/api/data/posts",
        { cache: "no-store" },
      );
      const postsData = await postsResponse.json();

      if (!postsResponse.ok) {
        throw new Error(
          postsData.error ??
            "投稿データを取得できませんでした。",
        );
      }

      const strategyResponse = await fetch(
        "/api/growth-strategy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            posts: postsData.posts ?? [],
          }),
        },
      );
      const strategyData =
        await strategyResponse.json();

      if (
        !strategyResponse.ok ||
        !strategyData.strategy
      ) {
        throw new Error(
          strategyData.error ??
            "成長戦略を計算できませんでした。",
        );
      }

      setStrategy(strategyData.strategy);

      const advisorResponse = await fetch(
        "/api/growth-strategy/ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            strategy: strategyData.strategy,
          }),
        },
      );
      const advisorData =
        await advisorResponse.json();

      if (!advisorResponse.ok || !advisorData.advisor) {
        throw new Error(
          advisorData.error ??
            "AI戦略を作成できませんでした。",
        );
      }

      setAdvisor(advisorData.advisor);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI戦略を作成できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI成長戦略アドバイザー"
        description="投稿実績を数値集計し、最優先課題と4週間の施策へ落とし込みます。"
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            AIは取得済み投稿だけを解釈します。フォロワー増加や成果を保証する予測は行いません。
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void analyze()}
              disabled={loading}
            >
              {loading
                ? "戦略作成中..."
                : "AI成長戦略を作成"}
            </Button>
            <Link
              href="/growth-strategy"
              className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
            >
              数値ダッシュボード
            </Link>
          </div>
        </div>
      </Panel>

      {error ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </Panel>
      ) : null}

      {!advisor ? (
        <Panel>
          <p className="text-sm text-stone-600">
            ボタンを押すと、現在の投稿実績から戦略を作成します。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="成長スコア"
              value={`${strategy?.score ?? 0}/100`}
            />
            <Metric
              label="対象投稿"
              value={`${strategy?.summary.postCount ?? 0}件`}
            />
            <Metric
              label="AI確信度"
              value={confidenceLabel(
                advisor.confidence,
              )}
            />
          </div>

          <Panel>
            <h2 className="font-semibold">
              AI総合評価
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-700">
              {advisor.executiveSummary}
            </p>
          </Panel>

          <Panel className="border-amber-200 bg-amber-50">
            <p className="text-xs font-semibold text-amber-800">
              最優先課題
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {advisor.topPriority.title}
            </h2>
            <p className="mt-3 text-sm leading-6">
              <strong>理由：</strong>
              {advisor.topPriority.reason}
            </p>
            <p className="mt-2 text-sm leading-6">
              <strong>実行：</strong>
              {advisor.topPriority.action}
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="font-semibold">
                伸ばすべき強み
              </h2>
              <List items={advisor.strengthsToScale} />
            </Panel>
            <Panel>
              <h2 className="font-semibold">
                避けるべき判断
              </h2>
              <List items={advisor.risksToAvoid} />
            </Panel>
          </div>

          <Panel>
            <h2 className="font-semibold">
              次に試す投稿仮説
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {advisor.experiments.map(
                (experiment, index) => (
                  <div
                    key={`${experiment.hypothesis}-${index}`}
                    className="rounded-lg border border-stone-200 bg-white p-5"
                  >
                    <p className="text-xs font-semibold text-stone-500">
                      EXPERIMENT {index + 1}
                    </p>
                    <h3 className="mt-2 font-bold">
                      {experiment.hypothesis}
                    </h3>
                    <p className="mt-3 text-sm leading-6">
                      {experiment.execution}
                    </p>
                    <p className="mt-3 rounded-md bg-fog p-3 text-sm">
                      <strong>成功判定：</strong>
                      {experiment.successMetric}
                    </p>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              4週間の重点施策
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {advisor.fourWeekPlan.map((week) => (
                <div
                  key={week.week}
                  className="rounded-lg border border-stone-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold text-stone-500">
                    WEEK {week.week}
                  </p>
                  <h3 className="mt-2 font-bold">
                    {week.objective}
                  </h3>
                  <List items={week.actions} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="font-semibold">
              分析上の制約
            </h2>
            <List items={advisor.limitations} />
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

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
      {items.length ? (
        items.map((item) => (
          <li key={item}>・{item}</li>
        ))
      ) : (
        <li>該当項目はありません。</li>
      )}
    </ul>
  );
}

function confidenceLabel(
  confidence: GrowthAdvisorResult["confidence"],
) {
  if (confidence === "high") return "高い";
  if (confidence === "medium") return "普通";
  return "低い";
}
