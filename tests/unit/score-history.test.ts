import { describe, expect, it } from "vitest";
import { scoreHistoryFromAnalysis } from "@/lib/score-history";
import type { AiAnalysis } from "@/lib/types";

describe("scoreHistoryFromAnalysis", () => {
  it("スコア内訳を履歴形式へ変換する", () => {
    const analysis: AiAnalysis = {
      firstImpression: "",
      imageMessage: "",
      captionClarity: "",
      strengths: "",
      weaknesses: "",
      reason: "",
      improvements: [],
      nextIdeas: [],
      hashtags: [],
      score: 82,
      scoreBreakdown: {
        total: 82,
        content: 18,
        visual: 15,
        caption: 17,
        engagement: 16,
        discoverability: 16,
        summary: "",
        confidence: "medium",
      },
    };

    expect(scoreHistoryFromAnalysis("post-1", "analysis-1", analysis)).toEqual({
      postId: "post-1",
      analysisId: "analysis-1",
      score: 82,
      contentScore: 18,
      visualScore: 15,
      captionScore: 17,
      engagementScore: 16,
      discoverabilityScore: 16,
    });
  });

  it("旧形式では内訳をnullにする", () => {
    const analysis: AiAnalysis = {
      firstImpression: "",
      imageMessage: "",
      captionClarity: "",
      strengths: "",
      weaknesses: "",
      reason: "",
      improvements: [],
      nextIdeas: [],
      hashtags: [],
      score: 70,
    };

    const result = scoreHistoryFromAnalysis("post-1", "analysis-1", analysis);

    expect(result.score).toBe(70);
    expect(result.contentScore).toBeNull();
    expect(result.visualScore).toBeNull();
  });
});
