import { describe, expect, it } from "vitest";
import {
  buildPerformanceReportAiPrompt,
  normalizePerformanceReportAiSummary,
} from "@/lib/performance-report-ai";
import type { PerformanceReport } from "@/lib/types";

const report: PerformanceReport = {
  period: { from: "2026-07-01", to: "2026-07-31" },
  previousPeriod: { from: "2026-06-01", to: "2026-06-30" },
  accountId: null,
  totals: {
    posts: 4,
    views: 1200,
    reach: 900,
    likes: 100,
    comments: 12,
    saves: 40,
    shares: 8,
  },
  averages: {
    views: 300,
    reach: 225,
    likes: 25,
    comments: 3,
    saves: 10,
    shares: 2,
    engagementRate: 13.3,
    saveRate: 3.3,
    aiScore: 82,
  },
  scoreBreakdown: {
    content: 17,
    visual: 15,
    caption: 18,
    engagement: 16,
    discoverability: 16,
  },
  bestPost: null,
  needsWorkPost: null,
  comparison: {
    posts: 0,
    views: 20,
    reach: null,
    saves: 10,
    engagementRate: 5,
    aiScore: 4,
  },
};

describe("performance report AI", () => {
  it("集計値をプロンプトへ含める", () => {
    const prompt = buildPerformanceReportAiPrompt(report);
    expect(prompt).toContain("1200");
    expect(prompt).toContain("82");
    expect(prompt).toContain("比較不能");
  });

  it("AI応答を正規化する", () => {
    const result = normalizePerformanceReportAiSummary({
      overallSummary: "総評",
      strengths: ["強み1", "", 1],
      weaknesses: ["弱み1"],
      nextActions: ["行動1"],
      contentIdeas: ["案1"],
      recommendedCtas: ["保存してください"],
      risks: ["データ不足"],
      evidence: ["表示数1200"],
    });

    expect(result.overallSummary).toBe("総評");
    expect(result.strengths).toEqual(["強み1"]);
    expect(result.evidence).toEqual(["表示数1200"]);
  });
});
