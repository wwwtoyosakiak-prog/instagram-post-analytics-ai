import type { GrowthStrategyResult } from "@/lib/growth-strategy";

export type GrowthAdvisorResult = {
  executiveSummary: string;
  topPriority: {
    title: string;
    reason: string;
    action: string;
  };
  strengthsToScale: string[];
  risksToAvoid: string[];
  experiments: Array<{
    hypothesis: string;
    execution: string;
    successMetric: string;
  }>;
  fourWeekPlan: Array<{
    week: number;
    objective: string;
    actions: string[];
  }>;
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 12)
    : [];
}

export function normalizeGrowthAdvisorResult(
  value: unknown,
): GrowthAdvisorResult {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const priority =
    source.topPriority &&
    typeof source.topPriority === "object"
      ? (source.topPriority as Record<string, unknown>)
      : {};

  const experiments = Array.isArray(source.experiments)
    ? source.experiments
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            hypothesis: text(row.hypothesis),
            execution: text(row.execution),
            successMetric: text(row.successMetric),
          };
        })
        .filter((item) => item.hypothesis && item.execution)
        .slice(0, 5)
    : [];

  const fourWeekPlan = Array.isArray(source.fourWeekPlan)
    ? source.fourWeekPlan
        .map((item, index) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            week:
              typeof row.week === "number"
                ? row.week
                : index + 1,
            objective: text(row.objective),
            actions: textArray(row.actions),
          };
        })
        .filter((item) => item.objective)
        .slice(0, 4)
    : [];

  const confidence =
    source.confidence === "high" ||
    source.confidence === "medium" ||
    source.confidence === "low"
      ? source.confidence
      : "low";

  return {
    executiveSummary: text(source.executiveSummary),
    topPriority: {
      title: text(priority.title),
      reason: text(priority.reason),
      action: text(priority.action),
    },
    strengthsToScale: textArray(source.strengthsToScale),
    risksToAvoid: textArray(source.risksToAvoid),
    experiments,
    fourWeekPlan,
    confidence,
    limitations: textArray(source.limitations),
  };
}

export function buildGrowthAdvisorPrompt(
  strategy: GrowthStrategyResult,
): string {
  return `あなたはInstagram運用の成長戦略アドバイザーです。
以下の集計済みデータだけを根拠に、日本語で実行可能な成長戦略を作成してください。

重要ルール:
- 入力にないフォロワー数、属性、競合情報を創作しない。
- 将来の成果やフォロワー増加を保証しない。
- 投稿数が10件未満なら確信度をlowにする。
- 曜日・時間帯は投稿数が少ない場合、暫定評価と明記する。
- 施策は4週間で実行できる具体性にする。
- 一度に変更する主要要素は1つにして、比較可能にする。
- JSONオブジェクトのみを出力する。

分析データ:
${JSON.stringify(strategy, null, 2)}

出力形式:
{
  "executiveSummary": "現状の総評",
  "topPriority": {
    "title": "最優先課題",
    "reason": "数値根拠",
    "action": "具体的な実行内容"
  },
  "strengthsToScale": ["伸ばすべき強み"],
  "risksToAvoid": ["避けるべき判断"],
  "experiments": [
    {
      "hypothesis": "検証仮説",
      "execution": "投稿での実施方法",
      "successMetric": "成功判定に使う指標"
    }
  ],
  "fourWeekPlan": [
    {
      "week": 1,
      "objective": "週の目的",
      "actions": ["実施内容"]
    }
  ],
  "confidence": "high",
  "limitations": ["分析上の制約"]
}`;
}
