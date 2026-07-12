import { describe, expect, it } from "vitest";
import {
  buildRetrospectiveSuggestion,
  retrospectiveCompleteness,
} from "@/lib/post-retrospective";
import { evaluatePostKpis } from "@/lib/post-kpi";

describe("post retrospective", () => {
  it("KPI評価から振り返り案を作る", () => {
    const evaluation = evaluatePostKpis(
      {
        views: 100,
        likes: 10,
        comments: 2,
        saves: 10,
        shares: 3,
      },
      {
        views: 60,
        likes: 12,
        comments: 2,
        saves: 4,
        shares: 4,
      },
    );

    const result =
      buildRetrospectiveSuggestion(evaluation);

    expect(
      result.negatives.some((item) =>
        item.includes("表示数"),
      ),
    ).toBe(true);

    expect(result.nextActions.length).toBeGreaterThan(0);
  });

  it("振り返り完成度を計算する", () => {
    const result = retrospectiveCompleteness({
      planId: "1",
      linkedPostId: null,
      summary: "総評",
      positives: ["良かった"],
      negatives: ["改善点"],
      nextActions: ["次回対応"],
      hypotheses: ["仮説"],
      continueActions: [],
      stopActions: [],
      confidence: "medium",
    });

    expect(result.percentage).toBe(100);
  });
});
