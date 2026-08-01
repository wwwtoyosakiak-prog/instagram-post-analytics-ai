import { describe, expect, it } from "vitest";
import { normalizeAiAnalysis } from "@/lib/ai-analysis";

describe("normalizeAiAnalysis", () => {
  it("旧形式の分析を壊さず読み込める", () => {
    const result = normalizeAiAnalysis({
      firstImpression: "印象", imageMessage: "画像", captionClarity: "明確",
      strengths: "強み", weaknesses: "弱み", reason: "理由",
      improvements: ["改善"], nextIdeas: ["案"], hashtags: ["#test"], score: 81,
    });
    expect(result.score).toBe(81);
    expect(result.improvements).toEqual(["改善"]);
    expect(result.hashtagSuggestion?.copyText).toBe("#test");
  });

  it("スコアを範囲内へ制限する", () => {
    const result = normalizeAiAnalysis({ score: 999, scoreBreakdown: {
      total: 150, content: 25, visual: -4, caption: 14, engagement: 19, discoverability: 18, confidence: "medium",
    }});
    expect(result.score).toBe(100);
    expect(result.scoreBreakdown?.content).toBe(20);
    expect(result.scoreBreakdown?.visual).toBe(0);
  });

  it("詳細改善案から旧形式を補完する", () => {
    const result = normalizeAiAnalysis({ improvementsDetailed: [{
      priority: "high", category: "冒頭", issue: "弱い", suggestion: "結論を先に置く", example: "完成形を冒頭に表示",
    }]});
    expect(result.improvements).toEqual(["結論を先に置く"]);
  });
});
