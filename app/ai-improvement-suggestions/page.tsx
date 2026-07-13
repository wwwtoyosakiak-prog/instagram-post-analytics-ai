"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import type {
  AiImprovementSuggestion,
  AiImprovementSuggestionResult,
} from "@/lib/ai-improvement-suggestion";
import type {
  AiWeeklyReviewHistoryItem,
} from "@/lib/ai-weekly-review-history";

export default function AiImprovementSuggestionsPage() {
  const [history, setHistory] = useState<
    AiWeeklyReviewHistoryItem[]
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] =
    useState<AiImprovementSuggestionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adoptingRank, setAdoptingRank] =
    useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

        const items = data.items ?? [];
        setHistory(items);

        if (items[0]?.id) {
          setSelectedId(items[0].id);
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

  const selected = history.find(
    (item) => item.id === selectedId,
  );

  async function generate() {
    if (!selected) {
      setError("AI週次レビューを選択してください。");
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/ai-improvement-suggestions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekStart: selected.weekStart,
            weekEnd: selected.weekEnd,
            aiReview: selected.aiReview,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.result) {
        throw new Error(
          data.error ??
            "AI改善案を作成できませんでした。",
        );
      }

      setResult(data.result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "AI改善案を作成できませんでした。",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function adopt(
    suggestion: AiImprovementSuggestion,
  ) {
    if (!result) return;

    setAdoptingRank(suggestion.rank);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai-improvement-cycles",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekStart: result.sourceWeekStart,
            weekEnd: result.sourceWeekEnd,
            title: suggestion.title,
            hypothesis: suggestion.hypothesis,
            action: suggestion.action,
            metricName: suggestion.metricName,
            baselineValue: suggestion.baselineValue,
            targetValue: suggestion.targetValue,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "改善サイクルへ登録できませんでした。",
        );
      }

      setMessage(
        `第${suggestion.rank}案を改善サイクルへ登録しました。`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "改善サイクルへ登録できませんでした。",
      );
    } finally {
      setAdoptingRank(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI改善案"
        description="AI週次レビューから、1週間で検証できる改善案を3件作成します。"
      />

      <Panel className="mb-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <label>元にするAI週次レビュー</label>
            <select
              className="mt-1"
              value={selectedId}
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
              disabled={loading}
            >
              <option value="">選択してください</option>
              {history.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.weekStart}〜{item.weekEnd}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => void generate()}
            disabled={
              generating || loading || !selected
            }
          >
            {generating
              ? "改善案を生成中..."
              : "AI改善案を生成"}
          </Button>

          <Link
            href="/ai-improvement-cycle"
            className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold"
          >
            改善サイクル
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

      {!result ? (
        <Panel>
          <p className="text-sm leading-6 text-stone-600">
            AI週次レビューを選び、改善案を生成してください。
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <p className="text-xs font-semibold text-stone-500">
              対象週
            </p>
            <h2 className="mt-2 text-xl font-bold">
              {result.sourceWeekStart}〜
              {result.sourceWeekEnd}
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-700">
              {result.summary}
            </p>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-3">
            {result.suggestions.map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.rank}-${suggestion.title}`}
                suggestion={suggestion}
                adopting={
                  adoptingRank === suggestion.rank
                }
                onAdopt={() =>
                  void adopt(suggestion)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  adopting,
  onAdopt,
}: {
  suggestion: AiImprovementSuggestion;
  adopting: boolean;
  onAdopt: () => void;
}) {
  return (
    <Panel
      className={
        suggestion.rank === 1
          ? "border-amber-300 bg-amber-50"
          : ""
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
          第{suggestion.rank}案
        </span>
        {suggestion.rank === 1 ? (
          <span className="text-xs font-semibold text-amber-800">
            AI推奨
          </span>
        ) : null}
      </div>

      <h2 className="mt-4 text-xl font-bold">
        {suggestion.title}
      </h2>

      <Section
        label="仮説"
        value={suggestion.hypothesis}
      />
      <Section
        label="実行する施策"
        value={suggestion.action}
      />
      <Section
        label="成功判定KPI"
        value={`${suggestion.metricName}：${
          suggestion.baselineValue ?? "未設定"
        } → ${suggestion.targetValue ?? "未設定"}`}
      />
      <Section
        label="優先する理由"
        value={suggestion.reason}
      />
      <Section
        label="注意点"
        value={suggestion.risk || "特記事項なし"}
      />

      <Button
        onClick={onAdopt}
        disabled={adopting}
      >
        {adopting
          ? "登録中..."
          : "この案を採用"}
      </Button>
    </Panel>
  );
}

function Section({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-stone-500">
        {label}
      </h3>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        {value}
      </p>
    </div>
  );
}
