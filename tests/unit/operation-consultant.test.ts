import { describe, expect, it } from "vitest";
import {
  buildOperationConsultantContext,
  normalizeOperationConsultantResult,
} from "@/lib/operation-consultant";
import type { InstagramPost } from "@/lib/types";

const post: InstagramPost = {
  id: "p1",
  accountId: "a1",
  date: "2026-07-10",
  recordedDate: "2026-07-10",
  url: "",
  caption: "工作動画",
  hashtags: "#工作",
  type: "reel",
  mediaCount: 1,
  likes: 10,
  comments: 2,
  saves: 5,
  shares: 1,
  views: 100,
  memo: "",
  createdAt: "",
  updatedAt: "",
};

describe("operation consultant", () => {
  it("期間内投稿を集計する", () => {
    const context = buildOperationConsultantContext(
      [post],
      [],
      "2026-07-01",
      "2026-07-31",
    );

    expect(context.summary.postCount).toBe(1);
    expect(context.summary.averageViews).toBe(100);
    expect(context.summary.topPostType).toBe("reel");
    expect(context.summary.averageEngagementRate).toBe(18);
  });

  it("AI回答を正規化する", () => {
    const result = normalizeOperationConsultantResult({
      weeklySummary: "総評",
      priorities: [
        {
          priority: "high",
          title: "保存率",
          reason: "低い",
          action: "CTAを追加",
        },
      ],
      weeklyCalendar: [
        {
          day: "月曜日",
          postType: "reel",
          theme: "制作工程",
          purpose: "表示数向上",
        },
      ],
    });

    expect(result.weeklySummary).toBe("総評");
    expect(result.priorities[0].priority).toBe("high");
    expect(result.weeklyCalendar[0].postType).toBe("reel");
  });
});
