import type { WeeklyOperationReview } from "@/lib/weekly-operation-review";

export type AiWeeklyReviewResult = {
  executiveSummary: string;
  bestPerformance: {
    title: string;
    reason: string;
  };
  biggestIssue: {
    title: string;
    reason: string;
    correctiveAction: string;
  };
  nextWeekPriority: {
    title: string;
    target: string;
    reason: string;
  };
  actionPlan: Array<{
    day: string;
    action: string;
    purpose: string;
  }>;
  continueActions: string[];
  stopActions: string[];
  successMetrics: string[];
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 12)
    : [];
}

function object(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeAiWeeklyReview(
  value: unknown,
): AiWeeklyReviewResult {
  const source = object(value);
  const best = object(source.bestPerformance);
  const issue = object(source.biggestIssue);
  const priority = object(source.nextWeekPriority);

  const actionPlan = Array.isArray(source.actionPlan)
    ? source.actionPlan
        .map((item) => {
          const row = object(item);

          return {
            day: text(row.day),
            action: text(row.action),
            purpose: text(row.purpose),
          };
        })
        .filter((item) => item.day && item.action)
        .slice(0, 7)
    : [];

  const confidence =
    source.confidence === "high" ||
    source.confidence === "medium" ||
    source.confidence === "low"
      ? source.confidence
      : "low";

  return {
    executiveSummary: text(source.executiveSummary),
    bestPerformance: {
      title: text(best.title),
      reason: text(best.reason),
    },
    biggestIssue: {
      title: text(issue.title),
      reason: text(issue.reason),
      correctiveAction: text(issue.correctiveAction),
    },
    nextWeekPriority: {
      title: text(priority.title),
      target: text(priority.target),
      reason: text(priority.reason),
    },
    actionPlan,
    continueActions: textArray(source.continueActions),
    stopActions: textArray(source.stopActions),
    successMetrics: textArray(source.successMetrics),
    confidence,
    limitations: textArray(source.limitations),
  };
}

export function buildAiWeeklyReviewPrompt(
  review: WeeklyOperationReview,
) {
  return `あなたはInstagram運用の週次レビュー担当です。
以下の週次集計だけを根拠に、翌週の実行計画を日本語で作成してください。

重要ルール:
- 入力にない事実や数値を創作しない。
- 記録日数が4日未満ならconfidenceをlowにする。
- 成果やフォロワー増加を保証しない。
- 来週の最優先課題は1つに絞る。
- 行動計画は7日以内で実行できる内容にする。
- 同時に変更する主要要素は1つまでにする。
- JSONオブジェクトだけを出力する。

週次レビュー:
${JSON.stringify(review, null, 2)}

出力形式:
{
  "executiveSummary": "今週の総評",
  "bestPerformance": {
    "title": "最も良かった点",
    "reason": "根拠"
  },
  "biggestIssue": {
    "title": "最も改善すべき点",
    "reason": "根拠",
    "correctiveAction": "具体的な修正行動"
  },
  "nextWeekPriority": {
    "title": "来週の最優先課題",
    "target": "達成目標",
    "reason": "理由"
  },
  "actionPlan": [
    {
      "day": "月曜日",
      "action": "具体的な行動",
      "purpose": "目的"
    }
  ],
  "continueActions": ["続けること"],
  "stopActions": ["やめる・減らすこと"],
  "successMetrics": ["成功判定に使う指標"],
  "confidence": "high",
  "limitations": ["分析上の制約"]
}`;
}
