import { describe, expect, it } from "vitest";
import { average, formatPercent, getMetrics, weekdayJa } from "@/lib/metrics";

describe("metrics", () => {
  it("投稿指標を計算する", () => {
    expect(getMetrics({ likes: 10, comments: 2, saves: 3, shares: 5, views: 100 })).toEqual({
      engagement: 20,
      engagementRate: 20,
      saveRate: 3,
      commentRate: 2
    });
  });

  it("表示数が0でもInfinityを返さない", () => {
    expect(getMetrics({ likes: 1, comments: 1, saves: 1, shares: 1, views: 0 }).engagementRate).toBe(0);
  });

  it("平均値と表示形式を返す", () => {
    expect(average([10, 20, 30])).toBe(20);
    expect(average([])).toBe(0);
    expect(formatPercent(12.345)).toBe("12.35%");
  });

  it("日本語の曜日を返す", () => {
    expect(weekdayJa("2026-07-11")).toBe("土");
  });
});
