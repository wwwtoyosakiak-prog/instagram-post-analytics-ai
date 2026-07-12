import { describe, expect, it } from "vitest";
import { calculateScoreHistorySummary } from "@/components/score-history-panel";
import type { AiScoreHistory } from "@/lib/types";

function item(score: number, overrides: Partial<AiScoreHistory> = {}): AiScoreHistory {
  return {
    id: score,
    postId: "post-1",
    analysisId: `analysis-${score}`,
    score,
    contentScore: 10,
    visualScore: 10,
    captionScore: 10,
    engagementScore: 10,
    discoverabilityScore: 10,
    createdAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateScoreHistorySummary", () => {
  it("初回と最新の差分を算出する", () => {
    const result = calculateScoreHistorySummary([
      item(70),
      item(82, { captionScore: 15 }),
    ]);

    expect(result.latestScore).toBe(82);
    expect(result.bestScore).toBe(82);
    expect(result.totalDelta).toBe(12);
    expect(result.comment).toContain("+12点");
    expect(result.comment).toContain("キャプション");
  });

  it("履歴がない場合の既定値を返す", () => {
    expect(calculateScoreHistorySummary([])).toEqual({
      latestScore: 0,
      bestScore: 0,
      totalDelta: 0,
      comment: "まだ分析履歴がありません。",
    });
  });
});
