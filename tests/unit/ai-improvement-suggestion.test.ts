import { describe, expect, it } from "vitest";
import {
  buildAiImprovementSuggestionPrompt,
  normalizeAiImprovementSuggestions,
} from "@/lib/ai-improvement-suggestion";

describe("AI improvement suggestions", () => {
  it("AI改善案を正規化する", () => {
    const result = normalizeAiImprovementSuggestions({
      sourceWeekStart: "2026-07-13",
      sourceWeekEnd: "2026-07-19",
      summary: "要約",
      suggestions: [
        {
          rank: 1,
          title: "保存率改善",
          hypothesis: "冒頭改善で保存率が上がる",
          action: "冒頭1秒で完成形を見せる",
          metricName: "保存率",
          baselineValue: 2,
          targetValue: 4,
          reason: "優先度が高い",
          risk: "他要素を変えない",
        },
      ],
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].rank).toBe(1);
  });

  it("プロンプトに週次レビューを含める", () => {
    const prompt = buildAiImprovementSuggestionPrompt(
      "2026-07-13",
      "2026-07-19",
      {
        executiveSummary: "総評",
        bestPerformance: { title: "強み", reason: "理由" },
        biggestIssue: {
          title: "準備不足",
          reason: "理由",
          correctiveAction: "修正",
        },
        nextWeekPriority: {
          title: "準備改善",
          target: "目標",
          reason: "理由",
        },
        actionPlan: [],
        continueActions: [],
        stopActions: [],
        successMetrics: [],
        confidence: "medium",
        limitations: [],
      },
    );

    expect(prompt).toContain("準備改善");
    expect(prompt).toContain("2026-07-13");
  });
});
