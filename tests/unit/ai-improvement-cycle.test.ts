import { describe, expect, it } from "vitest";
import {
  evaluateImprovementCycle,
} from "@/lib/ai-improvement-cycle";

describe("AI improvement cycle", () => {
  it("目標達成時は継続判定にする", () => {
    const result = evaluateImprovementCycle(
      2,
      4,
      4.5,
    );

    expect(result.decision).toBe("continue");
    expect(result.achievementRate).toBeGreaterThanOrEqual(
      100,
    );
  });

  it("途中まで改善した場合は修正判定にする", () => {
    const result = evaluateImprovementCycle(
      2,
      4,
      3,
    );

    expect(result.decision).toBe("adjust");
    expect(result.achievementRate).toBe(50);
  });

  it("悪化した場合は中止判定にする", () => {
    const result = evaluateImprovementCycle(
      2,
      4,
      1,
    );

    expect(result.decision).toBe("stop");
  });

  it("減少を目標にした指標も評価できる", () => {
    const result = evaluateImprovementCycle(
      10,
      5,
      5,
    );

    expect(result.decision).toBe("continue");
    expect(result.achievementRate).toBe(100);
  });
});
