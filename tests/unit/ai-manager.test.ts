import { describe, expect, it } from "vitest";
import { buildAiManager } from "@/lib/ai-manager";

describe("AI manager", () => {
  it("本日投稿と期限超過を優先タスク化する", () => {
    const result = buildAiManager({
      today: "2026-07-13",
      schedules: [
        {
          id: "1",
          title: "本日投稿",
          scheduledDate: "2026-07-13",
          scheduledTime: null,
          scheduleStatus: "scheduled",
          caption: "",
          hashtags: [],
          thumbnailText: "",
        },
        {
          id: "2",
          title: "期限超過",
          scheduledDate: "2026-07-12",
          scheduledTime: "20:00:00",
          scheduleStatus: "scheduled",
          caption: "本文",
          hashtags: ["#test"],
          thumbnailText: "表紙",
        },
      ],
      notifications: [],
      pipelineCards: [],
      growthStrategy: null,
      weekTarget: 3,
    });

    expect(result.summary.todayPosts).toBe(1);
    expect(result.summary.overduePosts).toBe(1);
    expect(result.tasks[0].priority).toBe("critical");
  });

  it("週目標との差を計算する", () => {
    const result = buildAiManager({
      today: "2026-07-13",
      schedules: [],
      notifications: [],
      pipelineCards: [],
      growthStrategy: {
        score: 50,
        risks: [],
      },
      weekTarget: 3,
    });

    expect(result.summary.remainingPosts).toBe(3);
    expect(
      result.tasks.some(
        (task) => task.id === "weekly-frequency",
      ),
    ).toBe(true);
  });
});
