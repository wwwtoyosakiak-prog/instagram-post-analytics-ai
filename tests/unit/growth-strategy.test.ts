import { describe, expect, it } from "vitest";
import {
  buildGrowthStrategy,
  normalizeGrowthPosts,
} from "@/lib/growth-strategy";

describe("growth strategy", () => {
  it("投稿データを安全に正規化する", () => {
    const posts = normalizeGrowthPosts([
      {
        id: "1",
        date: "2026-07-01T20:30:00",
        type: "REEL",
        views: "1000",
        likes: 50,
      },
    ]);

    expect(posts).toHaveLength(1);
    expect(posts[0].type).toBe("reel");
    expect(posts[0].views).toBe(1000);
  });

  it("成長戦略とロードマップを作成する", () => {
    const strategy = buildGrowthStrategy([
      {
        id: "1",
        date: "2026-07-01T20:30:00",
        type: "reel",
        caption: "工作",
        views: 1000,
        likes: 50,
        comments: 5,
        saves: 30,
        shares: 10,
      },
      {
        id: "2",
        date: "2026-07-03T20:30:00",
        type: "reel",
        caption: "イベント",
        views: 800,
        likes: 40,
        comments: 4,
        saves: 20,
        shares: 8,
      },
      {
        id: "3",
        date: "2026-07-05T18:00:00",
        type: "image",
        caption: "告知",
        views: 400,
        likes: 20,
        comments: 2,
        saves: 4,
        shares: 1,
      },
    ]);

    expect(strategy.summary.postCount).toBe(3);
    expect(strategy.roadmap).toHaveLength(4);
    expect(strategy.score).toBeGreaterThan(0);
    expect(strategy.contentMix[0].type).toBe("reel");
  });
});
