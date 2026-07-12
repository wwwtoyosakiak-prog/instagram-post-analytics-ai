import type { KpiEvaluation } from "@/lib/post-kpi";

export type RetrospectiveConfidence =
  | "high"
  | "medium"
  | "low";

export type PostRetrospective = {
  id: string;
  planId: string;
  linkedPostId: string | null;
  summary: string;
  positives: string[];
  negatives: string[];
  nextActions: string[];
  hypotheses: string[];
  continueActions: string[];
  stopActions: string[];
  confidence: RetrospectiveConfidence;
  createdAt: string;
  updatedAt: string;
};

export type RetrospectiveDraft = Omit<
  PostRetrospective,
  "id" | "createdAt" | "updatedAt"
>;

export function isRetrospectiveConfidence(
  value: unknown,
): value is RetrospectiveConfidence {
  return (
    value === "high" ||
    value === "medium" ||
    value === "low"
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(cleanText).filter(Boolean).slice(0, 20)
    : [];
}

export function normalizeRetrospectiveDraft(
  value: unknown,
): RetrospectiveDraft {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    planId: cleanText(source.planId),
    linkedPostId: cleanText(source.linkedPostId) || null,
    summary: cleanText(source.summary),
    positives: cleanArray(source.positives),
    negatives: cleanArray(source.negatives),
    nextActions: cleanArray(source.nextActions),
    hypotheses: cleanArray(source.hypotheses),
    continueActions: cleanArray(source.continueActions),
    stopActions: cleanArray(source.stopActions),
    confidence: isRetrospectiveConfidence(source.confidence)
      ? source.confidence
      : "medium",
  };
}

export function buildRetrospectiveSuggestion(
  evaluation: KpiEvaluation,
) {
  const positives: string[] = [];
  const negatives: string[] = [];
  const nextActions: string[] = [];
  const hypotheses: string[] = [];

  const entries = [
    ["表示数", evaluation.views],
    ["いいね", evaluation.likes],
    ["コメント", evaluation.comments],
    ["保存", evaluation.saves],
    ["シェア", evaluation.shares],
  ] as const;

  for (const [label, metric] of entries) {
    if (
      metric.achievementRate !== null &&
      metric.achievementRate >= 110
    ) {
      positives.push(
        `${label}が予測比${metric.achievementRate}%で好調`,
      );
    }

    if (
      metric.achievementRate !== null &&
      metric.achievementRate < 80
    ) {
      negatives.push(
        `${label}が予測比${metric.achievementRate}%で未達`,
      );
    }
  }

  if (evaluation.views.achievementRate !== null) {
    if (evaluation.views.achievementRate < 80) {
      nextActions.push(
        "冒頭3秒のフックとサムネイル文字を見直す",
      );
      hypotheses.push(
        "冒頭の訴求を具体化すると表示数が改善する可能性がある",
      );
    } else if (evaluation.saves.achievementRate !== null &&
               evaluation.saves.achievementRate < 80) {
      nextActions.push(
        "保存したくなる手順・チェックリスト形式を追加する",
      );
      hypotheses.push(
        "実用情報を増やすと保存率が改善する可能性がある",
      );
    }
  }

  if (!positives.length) {
    positives.push("現時点では明確な好調指標は未確認");
  }

  if (!negatives.length) {
    negatives.push("大きな未達指標は見つかっていない");
  }

  if (!nextActions.length) {
    nextActions.push(
      "好調だった構成を維持し、1要素だけ変更して比較する",
    );
  }

  if (!hypotheses.length) {
    hypotheses.push(
      "好調要素を固定し、CTAまたは投稿時間だけ変えると差を確認しやすい",
    );
  }

  return {
    positives,
    negatives,
    nextActions,
    hypotheses,
  };
}

export function retrospectiveCompleteness(
  retrospective: RetrospectiveDraft,
) {
  const checks = [
    retrospective.summary.length > 0,
    retrospective.positives.length > 0,
    retrospective.negatives.length > 0,
    retrospective.nextActions.length > 0,
    retrospective.hypotheses.length > 0,
  ];

  const completed = checks.filter(Boolean).length;

  return {
    completed,
    total: checks.length,
    percentage: Math.round((completed / checks.length) * 100),
  };
}
