import { describe, expect, it } from "vitest";
import {
  buildScheduleNotifications,
  sortNotifications,
  type OperationNotification,
} from "@/lib/notification-center";

describe("notification center", () => {
  it("本日投稿と準備不足の通知を生成する", () => {
    const result = buildScheduleNotifications(
      [
        {
          id: "1",
          title: "工作動画",
          scheduledDate: "2026-07-13",
          scheduledTime: null,
          scheduleStatus: "scheduled",
          reminderEnabled: true,
          caption: "",
          hashtags: [],
          thumbnailText: "",
        },
      ],
      "2026-07-13",
    );

    expect(
      result.some(
        (item) => item.notificationType === "post_today",
      ),
    ).toBe(true);

    expect(
      result.some(
        (item) =>
          item.notificationType === "preparation_incomplete",
      ),
    ).toBe(true);
  });

  it("未読かつ重要な通知を先頭に並べる", () => {
    const base: OperationNotification = {
      id: "1",
      sourceType: "post_schedule",
      sourceId: "1",
      notificationType: "test",
      severity: "info",
      title: "通知",
      message: "本文",
      actionUrl: null,
      dedupeKey: "1",
      isRead: false,
      occurredAt: "2026-07-13T00:00:00Z",
      readAt: null,
    };

    const sorted = sortNotifications([
      base,
      {
        ...base,
        id: "2",
        dedupeKey: "2",
        severity: "critical",
      },
    ]);

    expect(sorted[0].severity).toBe("critical");
  });
});
