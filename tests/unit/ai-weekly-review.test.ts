import { describe, expect, it } from "vitest";
import {
  buildAiWeeklyReviewPrompt,
  normalizeAiWeeklyReview,
} from "@/lib/ai-weekly-review";

describe("AI weekly review", () => {
  it("AI回答を正規化する", () => {
    const result = normalizeAiWeeklyReview({
      executiveSummary: "総評",
      bestPerformance: {
        title: "予定管理",
        reason: "高得点",
      },
      nextWeekPriority: {
        title: "準備改善",
        target: "80点",
        reason: "低下",
      },
      confidence: "medium",
    });

    expect(result.executiveSummary).toBe("総評");
    expect(result.bestPerformance.title).toBe(
      "予定管理",
    );
    expect(result.confidence).toBe("medium");
  });

  it("プロンプトに週次データを含める", () => {
    const prompt = buildAiWeeklyReviewPrompt({
      weekStart: "2026-07-13",
      weekEnd: "2026-07-19",
      daysRecorded: 5,
      averages: {
        totalScore: 80,
        scheduleScore: 90,
        preparationScore: 70,
        consistencyScore: 80,
        growthScore: 75,
        completionRate: 85,
      },
      tasks: {
        completed: 10,
        total: 12,
        remaining: 2,
      },
      previousWeekChange: null,
      improvedMetrics: [],
      declinedMetrics: [],
      strengths: [],
      concerns: [],
      nextWeekPriorities: [],
    });

    expect(prompt).toContain('"totalScore": 80');
    expect(prompt).toContain('"daysRecorded": 5');
  });
});
