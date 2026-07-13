import { describe, expect, it } from "vitest";
import { buildWeeklyOperationReview } from "@/lib/weekly-operation-review";
import type { ManagerDailySnapshot } from "@/lib/ai-manager-history";

function snapshot(
  date: string,
  totalScore: number,
  completionRate: number,
): ManagerDailySnapshot {
  return {
    id: date,
    snapshotDate: date,
    totalScore,
    scheduleScore: totalScore,
    preparationScore: totalScore,
    consistencyScore: totalScore,
    growthScore: totalScore,
    totalTasks: 4,
    completedTasks: Math.round((4 * completionRate) / 100),
    completionRate,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  };
}

describe("weekly operation review", () => {
  it("今週の平均値とタスク数を集計する", () => {
    const review = buildWeeklyOperationReview(
      [
        snapshot("2026-07-13", 80, 75),
        snapshot("2026-07-14", 90, 100),
      ],
      "2026-07-14",
    );

    expect(review.weekStart).toBe("2026-07-13");
    expect(review.averages.totalScore).toBe(85);
    expect(review.tasks.total).toBe(8);
    expect(review.daysRecorded).toBe(2);
  });

  it("前週比から改善指標を判定する", () => {
    const review = buildWeeklyOperationReview(
      [
        snapshot("2026-07-06", 60, 50),
        snapshot("2026-07-13", 80, 75),
      ],
      "2026-07-13",
    );

    expect(review.previousWeekChange?.totalScore).toBe(20);
    expect(review.improvedMetrics).toContain("総合スコア");
  });
});
