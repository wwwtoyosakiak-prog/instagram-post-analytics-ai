import { describe, expect, it } from "vitest";
import { compareBenchmarks } from "@/lib/competitor-comparison";

describe("compareBenchmarks", () => {
  it("自アカウントが強い場合を判定する", () => {
    const result = compareBenchmarks(
      {
        posts: 10,
        averageViews: 500,
        engagementRate: 8,
        topPostType: "reel",
      },
      {
        posts: 8,
        averageViews: 300,
        engagementRate: 5,
        topPostType: "image",
      },
    );

    expect(result.strongerSide).toBe("self");
    expect(result.viewDifference).toBe(200);
    expect(result.engagementDifference).toBe(3);
  });

  it("競合が強い場合を判定する", () => {
    const result = compareBenchmarks(
      {
        posts: 5,
        averageViews: 200,
        engagementRate: 4,
        topPostType: "image",
      },
      {
        posts: 10,
        averageViews: 600,
        engagementRate: 9,
        topPostType: "reel",
      },
    );

    expect(result.strongerSide).toBe("competitor");
  });
});
