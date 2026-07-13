import { describe, expect, it } from "vitest";
import {
  buildDailySnapshotPayload,
  calculateOperationStreak,
  calculateTaskCompletion,
  type ManagerDailySnapshot,
  type ManagerTaskState,
} from "@/lib/ai-manager-history";

const states: ManagerTaskState[] = [
  {
    id: "1",
    taskDate: "2026-07-13",
    taskKey: "task-1",
    title: "投稿",
    isCompleted: true,
    completedAt: "2026-07-13T10:00:00Z",
    note: "",
    updatedAt: "2026-07-13T10:00:00Z",
  },
];

describe("AI manager history", () => {
  it("タスク達成率を計算する", () => {
    const result = calculateTaskCompletion(
      ["task-1", "task-2"],
      states,
    );

    expect(result.completedTasks).toBe(1);
    expect(result.remainingTasks).toBe(1);
    expect(result.completionRate).toBe(50);
  });

  it("日次保存データを作る", () => {
    const payload = buildDailySnapshotPayload(
      {
        today: "2026-07-13",
        score: {
          total: 80,
          schedule: 90,
          preparation: 80,
          consistency: 70,
          growth: 75,
        },
        summary: {
          todayPosts: 1,
          tomorrowPosts: 0,
          overduePosts: 0,
          unreadNotifications: 0,
          incompletePosts: 1,
          weekScheduledPosts: 2,
          weekTarget: 3,
          remainingPosts: 1,
        },
        tasks: [
          {
            id: "task-1",
            title: "投稿",
            detail: "投稿する",
            priority: "high",
            actionUrl: "/posts",
          },
          {
            id: "task-2",
            title: "編集",
            detail: "編集する",
            priority: "medium",
            actionUrl: "/posts",
          },
        ],
        warnings: [],
        coachContext: "",
      },
      states,
    );

    expect(payload.totalTasks).toBe(2);
    expect(payload.completedTasks).toBe(1);
    expect(payload.completionRate).toBe(50);
  });

  it("連続運用日数を計算する", () => {
    const snapshots: ManagerDailySnapshot[] = [
      snapshot("2026-07-13"),
      snapshot("2026-07-12"),
      snapshot("2026-07-11"),
    ];

    expect(
      calculateOperationStreak(
        snapshots,
        "2026-07-13",
      ),
    ).toBe(3);
  });
});

function snapshot(
  snapshotDate: string,
): ManagerDailySnapshot {
  return {
    id: snapshotDate,
    snapshotDate,
    totalScore: 80,
    scheduleScore: 80,
    preparationScore: 80,
    consistencyScore: 80,
    growthScore: 80,
    totalTasks: 2,
    completedTasks: 1,
    completionRate: 50,
    createdAt: `${snapshotDate}T00:00:00Z`,
    updatedAt: `${snapshotDate}T00:00:00Z`,
  };
}
