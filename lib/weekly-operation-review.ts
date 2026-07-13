import type { ManagerDailySnapshot } from "@/lib/ai-manager-history";

export type WeeklyMetricChange = {
  totalScore: number;
  scheduleScore: number;
  preparationScore: number;
  consistencyScore: number;
  growthScore: number;
  completionRate: number;
};

export type WeeklyOperationReview = {
  weekStart: string;
  weekEnd: string;
  daysRecorded: number;
  averages: {
    totalScore: number;
    scheduleScore: number;
    preparationScore: number;
    consistencyScore: number;
    growthScore: number;
    completionRate: number;
  };
  tasks: { completed: number; total: number; remaining: number };
  previousWeekChange: WeeklyMetricChange | null;
  improvedMetrics: string[];
  declinedMetrics: string[];
  strengths: string[];
  concerns: string[];
  nextWeekPriorities: string[];
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export function getWeekRange(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + offset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function inRange(
  snapshots: ManagerDailySnapshot[],
  start: string,
  end: string,
) {
  return snapshots.filter(
    (snapshot) =>
      snapshot.snapshotDate >= start &&
      snapshot.snapshotDate <= end,
  );
}

function calculateAverages(snapshots: ManagerDailySnapshot[]) {
  return {
    totalScore: round(average(snapshots.map((x) => x.totalScore))),
    scheduleScore: round(average(snapshots.map((x) => x.scheduleScore))),
    preparationScore: round(average(snapshots.map((x) => x.preparationScore))),
    consistencyScore: round(average(snapshots.map((x) => x.consistencyScore))),
    growthScore: round(average(snapshots.map((x) => x.growthScore))),
    completionRate: round(average(snapshots.map((x) => x.completionRate))),
  };
}

export function buildWeeklyOperationReview(
  snapshots: ManagerDailySnapshot[],
  referenceDate: string,
): WeeklyOperationReview {
  const currentRange = getWeekRange(referenceDate);
  const previousDate = new Date(`${currentRange.start}T00:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previousRange = getWeekRange(previousDate.toISOString().slice(0, 10));

  const current = inRange(snapshots, currentRange.start, currentRange.end);
  const previous = inRange(snapshots, previousRange.start, previousRange.end);

  const averages = calculateAverages(current);
  const previousAverages = calculateAverages(previous);

  const change = previous.length
    ? {
        totalScore: round(averages.totalScore - previousAverages.totalScore),
        scheduleScore: round(averages.scheduleScore - previousAverages.scheduleScore),
        preparationScore: round(averages.preparationScore - previousAverages.preparationScore),
        consistencyScore: round(averages.consistencyScore - previousAverages.consistencyScore),
        growthScore: round(averages.growthScore - previousAverages.growthScore),
        completionRate: round(averages.completionRate - previousAverages.completionRate),
      }
    : null;

  const completed = current.reduce((sum, x) => sum + x.completedTasks, 0);
  const total = current.reduce((sum, x) => sum + x.totalTasks, 0);

  const labels: Array<[keyof WeeklyMetricChange, string]> = [
    ["totalScore", "総合スコア"],
    ["scheduleScore", "予定管理"],
    ["preparationScore", "投稿準備"],
    ["consistencyScore", "継続性"],
    ["growthScore", "成長"],
    ["completionRate", "タスク達成率"],
  ];

  const improvedMetrics = change
    ? labels.filter(([key]) => change[key] > 0).map(([, label]) => label)
    : [];
  const declinedMetrics = change
    ? labels.filter(([key]) => change[key] < 0).map(([, label]) => label)
    : [];

  const strengths: string[] = [];
  const concerns: string[] = [];
  const nextWeekPriorities: string[] = [];

  if (averages.completionRate >= 80) {
    strengths.push(`タスク達成率は平均${averages.completionRate}%で、計画を実行できています。`);
  } else {
    concerns.push(`タスク達成率は平均${averages.completionRate}%です。`);
    nextWeekPriorities.push("最重要タスクを1日3件以内に絞る");
  }

  if (averages.scheduleScore >= 80) {
    strengths.push("投稿予定の管理は安定しています。");
  } else {
    concerns.push("投稿予定日超過や時刻未設定を減らす必要があります。");
    nextWeekPriorities.push("週の初めに投稿予定日と時刻を確定する");
  }

  if (averages.preparationScore < 80) {
    concerns.push("投稿準備の不足が運用スコアを下げています。");
    nextWeekPriorities.push(
      "投稿前日までにキャプション・ハッシュタグ・サムネイルを完成させる",
    );
  } else {
    strengths.push("投稿準備は比較的安定しています。");
  }

  if (averages.consistencyScore < 70) {
    nextWeekPriorities.push("無理のない週3投稿の予定を先に確保する");
  }

  if (!nextWeekPriorities.length) {
    nextWeekPriorities.push(
      "今週の運用方法を維持し、改善する要素を1つだけ試す",
    );
  }

  if (current.length < 4) {
    concerns.push("記録日数が4日未満のため、週間評価は暫定的です。");
  }

  return {
    weekStart: currentRange.start,
    weekEnd: currentRange.end,
    daysRecorded: current.length,
    averages,
    tasks: {
      completed,
      total,
      remaining: Math.max(0, total - completed),
    },
    previousWeekChange: change,
    improvedMetrics,
    declinedMetrics,
    strengths,
    concerns,
    nextWeekPriorities: nextWeekPriorities.slice(0, 5),
  };
}
