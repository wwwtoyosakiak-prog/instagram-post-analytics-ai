import type { AiScoreHistory } from "@/lib/types";

const scoreLabels = {
  contentScore: "内容",
  visualScore: "ビジュアル",
  captionScore: "キャプション",
  engagementScore: "反応",
  discoverabilityScore: "発見性",
} as const;

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

    return [{ label, delta: latestValue - firstValue }];
  });

  const strongest = [...dimensions].sort((a, b) => b.delta - a.delta)[0];
  const weakest = [...dimensions].sort((a, b) => a.delta - b.delta)[0];

  let comment = history.length === 1
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
