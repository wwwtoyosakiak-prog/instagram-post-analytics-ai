"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiScoreHistory } from "@/lib/types";

type Props = {
  postId: string;
  refreshKey?: number;
};

type ApiResponse = {
  history?: AiScoreHistory[];
  error?: string;
};

const scoreLabels = {
  contentScore: "内容",
  visualScore: "ビジュアル",
  captionScore: "キャプション",
  engagementScore: "反応",
  discoverabilityScore: "発見性",
} as const;

export function ScoreHistoryPanel({ postId, refreshKey = 0 }: Props) {
  const [history, setHistory] = useState<AiScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/data/score-history?postId=${encodeURIComponent(postId)}&limit=100`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(data.error || "スコア履歴を取得できませんでした。");
        }

        if (active) setHistory(data.history ?? []);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "スコア履歴を取得できませんでした。",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [postId, refreshKey]);

  const chartData = useMemo(
    () =>
      history.map((item, index) => ({
        ...item,
        label: new Intl.DateTimeFormat("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(item.createdAt)),
        sequence: index + 1,
      })),
    [history],
  );

  const summary = useMemo(() => calculateScoreHistorySummary(history), [history]);

  const radarData = useMemo(() => {
    const latest = history.at(-1);
    if (!latest) return [];

    return Object.entries(scoreLabels).map(([key, label]) => ({
      subject: label,
      score: latest[key as keyof typeof scoreLabels] ?? 0,
      fullMark: 20,
    }));
  }, [history]);

  if (loading) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white/80 p-5">
        <h2 className="font-semibold">AIスコア履歴</h2>
        <p className="mt-3 text-sm text-stone-500">履歴を読み込んでいます...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-900">AIスコア履歴</h2>
        <p className="mt-2 text-sm text-red-700">{error}</p>
      </section>
    );
  }

  if (!history.length) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white/80 p-5">
        <h2 className="font-semibold">AIスコア履歴</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          まだ履歴がありません。新しくAI分析を保存すると、ここにスコア推移が表示されます。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-stone-200 bg-white/80 p-5">
      <div>
        <h2 className="font-semibold">AIスコア履歴</h2>
        <p className="mt-1 text-sm text-stone-600">
          同じ投稿を再分析したときの変化を確認できます。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="最新スコア" value={`${summary.latestScore}点`} />
        <SummaryCard
          label="初回からの変化"
          value={`${summary.totalDelta >= 0 ? "+" : ""}${summary.totalDelta}点`}
          positive={summary.totalDelta >= 0}
        />
        <SummaryCard label="分析回数" value={`${history.length}回`} />
        <SummaryCard label="最大スコア" value={`${summary.bestScore}点`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-semibold">総合スコア推移</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={24} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="総合スコア"
                  stroke="currentColor"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-semibold">最新分析のバランス</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis domain={[0, 20]} />
                <Radar
                  dataKey="score"
                  name="最新スコア"
                  stroke="currentColor"
                  fill="currentColor"
                  fillOpacity={0.2}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold">5項目の推移</h3>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis domain={[0, 20]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="contentScore" name="内容" connectNulls />
              <Line type="monotone" dataKey="visualScore" name="ビジュアル" connectNulls />
              <Line type="monotone" dataKey="captionScore" name="キャプション" connectNulls />
              <Line type="monotone" dataKey="engagementScore" name="反応" connectNulls />
              <Line type="monotone" dataKey="discoverabilityScore" name="発見性" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg bg-fog p-4">
        <h3 className="text-sm font-semibold">改善トレンド</h3>
        <p className="mt-2 text-sm leading-6 text-stone-700">{summary.comment}</p>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs font-semibold text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${positive === false ? "text-red-700" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

export function calculateScoreHistorySummary(history: AiScoreHistory[]) {
  if (!history.length) {
    return {
      latestScore: 0,
      bestScore: 0,
      totalDelta: 0,
      comment: "まだ分析履歴がありません。",
    };
  }

  const first = history[0];
  const latest = history[history.length - 1];
  const best = Math.max(...history.map((item) => item.score));
  const totalDelta = latest.score - first.score;

  const dimensions = Object.entries(scoreLabels).flatMap(([key, label]) => {
    const scoreKey = key as keyof typeof scoreLabels;
    const firstValue = first[scoreKey];
    const latestValue = latest[scoreKey];

    if (typeof firstValue !== "number" || typeof latestValue !== "number") {
      return [];
    }

    return [{
      label,
      delta: latestValue - firstValue,
    }];
  });

  const strongest = [...dimensions].sort((a, b) => b.delta - a.delta)[0];
  const weakest = [...dimensions].sort((a, b) => a.delta - b.delta)[0];

  let comment =
    history.length === 1
      ? "初回分析が保存されました。今後の再分析結果と比較できます。"
      : `総合スコアは初回から${totalDelta >= 0 ? "+" : ""}${totalDelta}点です。`;

  if (history.length > 1 && strongest && strongest.delta > 0) {
    comment += ` 特に「${strongest.label}」が${strongest.delta}点改善しています。`;
  }

  if (history.length > 1 && weakest && weakest.delta < 0) {
    comment += ` 一方、「${weakest.label}」は${Math.abs(weakest.delta)}点低下しているため、次回の見直し候補です。`;
  }

  return {
    latestScore: latest.score,
    bestScore: best,
    totalDelta,
    comment,
  };
}
