import { describe, expect, it } from "vitest";
import {
  buildLearningSummary,
  calculateImprovementRate,
  calculateLearningStats,
  findSimilarMemories,
  type AiLearningMemory,
} from "@/lib/ai-learning";

function memory(
  id: string,
  title: string,
  outcome: AiLearningMemory["outcome"],
  rate: number | null,
): AiLearningMemory {
  return {
    id,
    improvementCycleId: id,
    title,
    hypothesis: `${title}の仮説`,
    action: `${title}を実施`,
    metricName: "保存率",
    baselineValue: 2,
    targetValue: 4,
    resultValue: 4,
    improvementRate: rate,
    outcome,
    learningSummary: `${title}の学習`,
    tags: [title, "保存率"],
    createdAt: "2026-07-13T00:00:00Z",
    updatedAt: "2026-07-13T00:00:00Z",
  };
}

describe("AI learning", () => {
  it("目標達成率を計算する", () => {
    expect(calculateImprovementRate(2, 4, 3)).toBe(50);
    expect(calculateImprovementRate(10, 5, 5)).toBe(100);
  });

  it("学習統計を計算する", () => {
    const stats = calculateLearningStats([
      memory("1", "冒頭改善", "success", 120),
      memory("2", "字幕改善", "partial", 60),
      memory("3", "投稿時間", "failure", -20),
    ]);

    expect(stats.total).toBe(3);
    expect(stats.success).toBe(1);
    expect(stats.successRate).toBe(33);
    expect(stats.averageImprovementRate).toBe(53.3);
  });

  it("類似する学習データを検索する", () => {
    const result = findSimilarMemories(
      "保存率 冒頭改善",
      [
        memory("1", "冒頭改善", "success", 120),
        memory("2", "投稿時間", "failure", -20),
      ],
    );

    expect(result[0].memory.title).toBe("冒頭改善");
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("改善サイクルから学習要約を作る", () => {
    const summary = buildLearningSummary({
      title: "保存率改善",
      metricName: "保存率",
      baselineValue: 2,
      targetValue: 4,
      resultValue: 4,
      status: "continue",
      evaluation: "目標達成",
    });

    expect(summary).toContain("成功");
    expect(summary).toContain("100%");
  });
});
