import { describe, expect, it } from "vitest";
import {
  buildGrowthAdvisorPrompt,
  normalizeGrowthAdvisorResult,
} from "@/lib/growth-advisor";

describe("growth advisor", () => {
  it("AI回答を正規化する", () => {
    const result = normalizeGrowthAdvisorResult({
      executiveSummary: "総評",
      topPriority: {
        title: "保存率改善",
        reason: "保存率が低い",
        action: "手順投稿を作る",
      },
      strengthsToScale: ["リール"],
      confidence: "medium",
    });

    expect(result.executiveSummary).toBe("総評");
    expect(result.topPriority.title).toBe(
      "保存率改善",
    );
    expect(result.confidence).toBe("medium");
  });

  it("プロンプトに分析値を含める", () => {
    const prompt = buildGrowthAdvisorPrompt({
      score: 55,
      period: {
        from: "2026-07-01",
        to: "2026-07-10",
        days: 10,
      },
      summary: {
        postCount: 4,
        postsPerWeek: 2.8,
        averageViews: 500,
        averageEngagementRate: 5,
        averageSaveRate: 1,
        averageShareRate: 0.5,
      },
      contentMix: [],
      weekdayPerformance: [],
      hourPerformance: [],
      topPosts: [],
      bottomPosts: [],
      strengths: [],
      risks: [],
      roadmap: [],
    });

    expect(prompt).toContain('"score": 55');
    expect(prompt).toContain('"postCount": 4');
  });
});
