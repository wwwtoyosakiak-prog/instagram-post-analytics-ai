import type {
  ImprovementCycle,
  ImprovementCycleStatus,
} from "@/lib/ai-improvement-cycle";

export type LearningOutcome =
  | "success"
  | "partial"
  | "failure"
  | "unknown";

export type AiLearningMemory = {
  id: string;
  improvementCycleId: string | null;
  title: string;
  hypothesis: string;
  action: string;
  metricName: string;
  baselineValue: number | null;
  targetValue: number | null;
  resultValue: number | null;
  improvementRate: number | null;
  outcome: LearningOutcome;
  learningSummary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AiLearningStats = {
  total: number;
  success: number;
  partial: number;
  failure: number;
  unknown: number;
  successRate: number;
  averageImprovementRate: number | null;
};

export function outcomeFromStatus(
  status: ImprovementCycleStatus,
): LearningOutcome {
  if (status === "continue") return "success";
  if (status === "adjust") return "partial";
  if (status === "stop") return "failure";
  return "unknown";
}

export function calculateImprovementRate(
  baselineValue: number | null,
  targetValue: number | null,
  resultValue: number | null,
) {
  if (
    baselineValue === null ||
    targetValue === null ||
    resultValue === null
  ) {
    return null;
  }

  const plannedChange = targetValue - baselineValue;

  if (plannedChange === 0) {
    return resultValue === targetValue ? 100 : 0;
  }

  return Math.round(
    ((resultValue - baselineValue) /
      plannedChange) *
      1000,
  ) / 10;
}

export function buildLearningSummary(
  cycle: Pick<
    ImprovementCycle,
    | "title"
    | "metricName"
    | "baselineValue"
    | "targetValue"
    | "resultValue"
    | "status"
    | "evaluation"
  >,
) {
  const outcome = outcomeFromStatus(cycle.status);
  const rate = calculateImprovementRate(
    cycle.baselineValue,
    cycle.targetValue,
    cycle.resultValue,
  );

  const outcomeLabel =
    outcome === "success"
      ? "成功"
      : outcome === "partial"
        ? "一部成功"
        : outcome === "failure"
          ? "失敗"
          : "未判定";

  const values =
    cycle.baselineValue !== null &&
    cycle.resultValue !== null
      ? `${cycle.metricName}は${cycle.baselineValue}から${cycle.resultValue}へ変化`
      : `${cycle.metricName}の数値評価は不十分`;

  return `${cycle.title}は${outcomeLabel}。${values}。${
    rate === null ? "" : `目標に対する達成率は${rate}%。`
  }${cycle.evaluation ? ` ${cycle.evaluation}` : ""}`.trim();
}

export function buildTags(
  title: string,
  metricName: string,
  action: string,
) {
  const values = [
    title,
    metricName,
    ...action
      .split(/[、。\s/・]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2),
  ];

  return [...new Set(values)].slice(0, 12);
}

export function calculateLearningStats(
  memories: AiLearningMemory[],
): AiLearningStats {
  const success = memories.filter(
    (memory) => memory.outcome === "success",
  ).length;
  const partial = memories.filter(
    (memory) => memory.outcome === "partial",
  ).length;
  const failure = memories.filter(
    (memory) => memory.outcome === "failure",
  ).length;
  const unknown = memories.filter(
    (memory) => memory.outcome === "unknown",
  ).length;

  const rated = memories
    .map((memory) => memory.improvementRate)
    .filter(
      (value): value is number => value !== null,
    );

  return {
    total: memories.length,
    success,
    partial,
    failure,
    unknown,
    successRate: memories.length
      ? Math.round((success / memories.length) * 100)
      : 0,
    averageImprovementRate: rated.length
      ? Math.round(
          (rated.reduce((sum, value) => sum + value, 0) /
            rated.length) *
            10,
        ) / 10
      : null,
  };
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[、。\s/・]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  );
}

export function similarityScore(
  query: string,
  memory: AiLearningMemory,
) {
  const queryTokens = tokenize(query);
  const memoryTokens = tokenize(
    [
      memory.title,
      memory.hypothesis,
      memory.action,
      memory.metricName,
      ...memory.tags,
    ].join(" "),
  );

  if (!queryTokens.size || !memoryTokens.size) {
    return 0;
  }

  const matches = [...queryTokens].filter((token) =>
    memoryTokens.has(token),
  ).length;

  return Math.round(
    (matches / queryTokens.size) * 100,
  );
}

export function findSimilarMemories(
  query: string,
  memories: AiLearningMemory[],
  limit = 5,
) {
  return memories
    .map((memory) => ({
      memory,
      score: similarityScore(query, memory),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const outcomeWeight = {
        success: 3,
        partial: 2,
        failure: 1,
        unknown: 0,
      };

      return (
        outcomeWeight[b.memory.outcome] -
        outcomeWeight[a.memory.outcome]
      );
    })
    .slice(0, limit);
}

export function buildLearningContext(
  memories: AiLearningMemory[],
) {
  if (!memories.length) {
    return "過去の改善学習データはありません。";
  }

  return memories
    .slice(0, 10)
    .map(
      (memory, index) =>
        `${index + 1}. ${memory.title}
結果: ${memory.outcome}
KPI: ${memory.metricName}
改善率: ${
          memory.improvementRate === null
            ? "不明"
            : `${memory.improvementRate}%`
        }
学習: ${memory.learningSummary}`,
    )
    .join("\n\n");
}
