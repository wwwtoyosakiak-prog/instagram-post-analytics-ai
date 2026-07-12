import { describe, expect, it } from "vitest";
import {
  findScheduleGaps,
  scheduleReadiness,
  type ScheduledPost,
} from "@/lib/post-scheduling";

const post: ScheduledPost = {
  id: "1",
  title: "工作動画",
  theme: "段ボール",
  postType: "reel",
  scheduledDate: "2026-07-15",
  scheduledTime: "20:30:00",
  scheduleStatus: "scheduled",
  timezone: "Asia/Tokyo",
  reminderEnabled: true,
  caption: "投稿文",
  thumbnailText: "工作に挑戦",
  hashtags: ["#工作"],
  updatedAt: "2026-07-13T00:00:00Z",
};

describe("post scheduling", () => {
  it("投稿準備率を計算する", () => {
    const result = scheduleReadiness(post);

    expect(result.percentage).toBe(100);
    expect(result.completed).toBe(5);
  });

  it("週単位の空き投稿枠を検出する", () => {
    const gaps = findScheduleGaps(
      [post],
      "2026-07-13",
      7,
      3,
    );

    expect(gaps).toHaveLength(1);
    expect(gaps[0].scheduledCount).toBe(1);
    expect(gaps[0].missingCount).toBe(2);
  });
});
