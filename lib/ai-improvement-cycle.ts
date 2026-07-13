export type ImprovementCycleStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "continue"
  | "adjust"
  | "stop";

export type ImprovementCycle = {
  id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  hypothesis: string;
  action: string;
  metricName: string;
  baselineValue: number | null;
  targetValue: number | null;
  resultValue: number | null;
  status: ImprovementCycleStatus;
  evaluation: string;
  createdAt: string;
  updatedAt: string;
};

export type ImprovementCycleInput = {
  weekStart: string;
  weekEnd: string;
  title: string;
  hypothesis: string;
  action: string;
  metricName: string;
  baselineValue: number | null;
  targetValue: number | null;
};

export function evaluateImprovementCycle(
  baselineValue: number | null,
  targetValue: number | null,
  resultValue: number | null,
) {
  if (
    baselineValue === null ||
    targetValue === null ||
    resultValue === null
  ) {
    return {
      decision: "adjust" as const,
      achievementRate: null,
      message:
        "評価に必要な数値が不足しています。基準値・目標値・結果値を確認してください。",
    };
  }

  const direction =
    targetValue >= baselineValue ? 1 : -1;
  const plannedChange =
    Math.abs(targetValue - baselineValue);
  const actualChange =
    direction * (resultValue - baselineValue);

  if (plannedChange === 0) {
    return {
      decision:
        resultValue === targetValue
          ? ("continue" as const)
          : ("adjust" as const),
      achievementRate:
        resultValue === targetValue ? 100 : 0,
      message:
        resultValue === targetValue
          ? "目標値を維持できています。"
          : "目標値との差を確認し、施策を調整してください。",
    };
  }

  const achievementRate = Math.round(
    (actualChange / plannedChange) * 100,
  );

  if (achievementRate >= 100) {
    return {
      decision: "continue" as const,
      achievementRate,
      message:
        "目標を達成しました。施策を継続し、再現性を確認してください。",
    };
  }

  if (achievementRate >= 50) {
    return {
      decision: "adjust" as const,
      achievementRate,
      message:
        "改善傾向はありますが、目標未達です。施策を一部修正してください。",
    };
  }

  return {
    decision: "stop" as const,
    achievementRate,
    message:
      "十分な改善が確認できませんでした。施策の中止または仮説の見直しを推奨します。",
  };
}

export function cycleStatusLabel(
  status: ImprovementCycleStatus,
) {
  if (status === "planned") return "計画";
  if (status === "in_progress") return "実行中";
  if (status === "completed") return "評価待ち";
  if (status === "continue") return "継続";
  if (status === "adjust") return "修正";
  return "中止";
}
