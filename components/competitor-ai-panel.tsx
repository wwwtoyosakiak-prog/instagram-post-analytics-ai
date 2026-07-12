"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type {
  CompetitorAiAnalysis,
  CompetitorBenchmarkInput,
} from "@/lib/competitor-ai-analysis";

export function CompetitorAiPanel({
  own,
  competitor,
}: CompetitorBenchmarkInput) {
  const [analysis, setAnalysis] =
    useState<CompetitorAiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/competitor-ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ own, competitor }),
      });

      const data = await response.json();

      if (!response.ok || !data.analysis) {
        throw new Error(
          data.error ?? "AI競合分析を実行できませんでした。",
        );
      }

      setAnalysis(data.analysis);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI競合分析を実行できませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-stone-200 pt-5">
      <Button
        onClick={() => void runAnalysis()}
        disabled={loading || competitor.posts === 0}
      >
        {loading ? "AI分析中..." : "AI競合分析を実行"}
      </Button>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {analysis ? (
        <div className="mt-6 space-y-5 rounded-xl border border-stone-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase text-stone-500">
              AI Competitor Analysis
            </p>
            <h3 className="mt-1 text-lg font-bold">AI競合分析結果</h3>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              {analysis.overallSummary}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <AiList title="勝っている・活かせる点" items={analysis.winningPoints} />
            <AiList title="改善余地のある点" items={analysis.losingPoints} />
            <AiList title="すぐ実行すること" items={analysis.immediateActions} />
            <AiList title="7日間の行動計画" items={analysis.sevenDayPlan} />
            <AiList title="次の投稿テーマ" items={analysis.contentIdeas} />
            <AiList title="競合から学べること" items={analysis.benchmarkLessons} />
          </div>

          <AiList title="比較上の注意点" items={analysis.cautions} />

          <div className="rounded-lg bg-fog p-4">
            <AiList title="数値根拠" items={analysis.evidence} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AiList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
        {items.length ? (
          items.map((item) => <li key={item}>・{item}</li>)
        ) : (
          <li>該当項目はありません。</li>
        )}
      </ul>
    </div>
  );
}
