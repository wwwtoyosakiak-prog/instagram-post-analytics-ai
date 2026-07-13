import type { ManagerResult } from "@/lib/ai-manager";

export type ManagerTaskState = {
  id: string;
  taskDate: string;
  taskKey: string;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  note: string;
  updatedAt: string;
};

export type ManagerDailySnapshot = {
  id: string;
  snapshotDate: string;
  totalScore: number;
  scheduleScore: number;
  preparationScore: number;
  consistencyScore: number;
  growthScore: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  createdAt: string;
  updatedAt: string;
};

export function calculateTaskCompletion(
  taskKeys: string[],
  states: ManagerTaskState[],
) {
  const stateMap = new Map(
    states.map((state) => [state.taskKey, state]),
  );

  const completedTasks = taskKeys.filter(
    (key) => stateMap.get(key)?.isCompleted,
  ).length;

  const totalTasks = taskKeys.length;
  const completionRate = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 100;

  return {
    totalTasks,
    completedTasks,
    remainingTasks: totalTasks - completedTasks,
    completionRate,
  };
}

export function buildDailySnapshotPayload(
  manager: ManagerResult,
  states: ManagerTaskState[],
) {
  const completion = calculateTaskCompletion(
    manager.tasks.map((task) => task.id),
    states,
  );

  return {
    snapshotDate: manager.today,
    totalScore: manager.score.total,
    scheduleScore: manager.score.schedule,
    preparationScore: manager.score.preparation,
    consistencyScore: manager.score.consistency,
    growthScore: manager.score.growth,
    totalTasks: completion.totalTasks,
    completedTasks: completion.completedTasks,
    completionRate: completion.completionRate,
    summary: manager.summary,
    warnings: manager.warnings,
  };
}

export function calculateOperationStreak(
  snapshots: ManagerDailySnapshot[],
  today: string,
) {
  const dates = new Set(
    snapshots
      .filter((snapshot) => snapshot.completionRate > 0)
      .map((snapshot) => snapshot.snapshotDate),
  );

  let streak = 0;
  let currentDate = today;

  while (dates.has(currentDate)) {
    streak += 1;

    const [year, month, day] = currentDate
      .split("-")
      .map(Number);

    const previousDate = new Date(
      Date.UTC(year, month - 1, day - 1),
    );

    currentDate = previousDate
      .toISOString()
      .slice(0, 10);
  }

  return streak;
}
