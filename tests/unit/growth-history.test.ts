import { describe, expect, it } from "vitest";
import {
  calculateGrowthChange,
  summarizeGrowthChanges,
  type GrowthSnapshot,
} from "@/lib/growth-history";

const previous: GrowthSnapshot = {
  id: "1",
  score: 60,
  postCount: 10,
  postsPerWeek: 2,
  averageViews: 500,
  averageEngagementRate: 5,
  averageSaveRate: 1.5,
  averageShareRate: 0.5,
  periodFrom: "2026-06-01",
  periodTo: "2026-06-30",
  createdAt: "2026-07-01T00:00:00Z",
};

const current: GrowthSnapshot = {
  ...previous,
  id: "2",
  score: 70,
  postsPerWeek: 3,
  averageViews: 650,
  averageSaveRate: 2,
  createdAt: "2026-07-13T00:00:00Z",
};

describe("growth history", () => {
  it("前回比を計算する", () => {
    const change = calculateGrowthChange(current, previous);

    expect(change?.score).toBe(10);
    expect(change?.postsPerWeek).toBe(1);
    expect(change?.averageViews).toBe(150);
  });

  it("改善指標を分類する", () => {
    const summary = summarizeGrowthChanges(
      calculateGrowthChange(current, previous),
    );

    expect(summary.improved).toContain("成長スコア");
    expect(summary.improved).toContain("平均保存率");
  });
});
