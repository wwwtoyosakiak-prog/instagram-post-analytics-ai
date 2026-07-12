import { describe, expect, it } from "vitest";
import {
  buildCompetitorAiPrompt,
  normalizeCompetitorAiAnalysis,
} from "@/lib/competitor-ai-analysis";

describe("competitor AI analysis", () => {
  it("比較データをプロンプトへ含める", () => {
    const prompt = buildCompetitorAiPrompt({
      own: {
        posts: 10,
        averageViews: 500,
        engagementRate: 8,
        topPostType: "reel",
      },
      competitor: {
        name: "競合A",
        username: "example",
        posts: 12,
        averageViews: 900,
        engagementRate: 6,
        topPostType: "carousel",
        topHashtags: ["#工作"],
      },
    });

    expect(prompt).toContain("500");
    expect(prompt).toContain("900");
    expect(prompt).toContain("#工作");
  });

  it("AI応答を正規化する", () => {
    const result = normalizeCompetitorAiAnalysis({
      overallSummary: "総評",
      winningPoints: ["反応率"],
      losingPoints: ["表示数"],
      immediateActions: ["冒頭を改善"],
      evidence: ["500対900"],
    });

    expect(result.overallSummary).toBe("総評");
    expect(result.immediateActions).toEqual(["冒頭を改善"]);
    expect(result.sevenDayPlan).toEqual([]);
  });
});
