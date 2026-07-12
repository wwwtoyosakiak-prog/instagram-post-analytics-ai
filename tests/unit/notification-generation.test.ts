import { describe, expect, it } from "vitest";
import { buildScheduleNotifications } from "@/lib/notification-center";

describe("automatic notification generation", () => {
  it("同じ日・投稿では同じdedupe keyを作る", () => {
    const source = [
      {
        id: "post-1",
        title: "工作動画",
        scheduledDate: "2026-07-13",
        scheduledTime: "20:30:00",
        scheduleStatus: "scheduled",
        reminderEnabled: true,
        caption: "投稿文",
        hashtags: ["#工作"],
        thumbnailText: "工作動画",
      },
    ];

    const first = buildScheduleNotifications(
      source,
      "2026-07-13",
    );
    const second = buildScheduleNotifications(
      source,
      "2026-07-13",
    );

    expect(first[0].dedupeKey).toBe(second[0].dedupeKey);
  });

  it("リマインダー無効の投稿は通知候補にしない", () => {
    const result = buildScheduleNotifications(
      [
        {
          id: "post-1",
          title: "工作動画",
          scheduledDate: "2026-07-13",
          scheduledTime: null,
          scheduleStatus: "scheduled",
          reminderEnabled: false,
          caption: "",
          hashtags: [],
          thumbnailText: "",
        },
      ],
      "2026-07-13",
    );

    expect(result).toHaveLength(0);
  });
});
