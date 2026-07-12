export type NotificationSeverity =
  | "info"
  | "warning"
  | "critical";

export type OperationNotification = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  notificationType: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actionUrl: string | null;
  dedupeKey: string;
  isRead: boolean;
  occurredAt: string;
  readAt: string | null;
};

export type NotificationCandidate = Omit<
  OperationNotification,
  "id" | "isRead" | "occurredAt" | "readAt"
>;

export type ScheduleSource = {
  id: string;
  title: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduleStatus: string;
  reminderEnabled: boolean;
  caption: string;
  hashtags: string[];
  thumbnailText: string;
};

export function buildScheduleNotifications(
  posts: ScheduleSource[],
  today: string,
): NotificationCandidate[] {
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const notifications: NotificationCandidate[] = [];

  for (const post of posts) {
    if (!post.reminderEnabled) continue;
    if (
      post.scheduleStatus === "published" ||
      post.scheduleStatus === "cancelled"
    ) {
      continue;
    }

    const missing: string[] = [];
    if (!post.scheduledTime) missing.push("投稿時刻");
    if (!post.caption.trim()) missing.push("キャプション");
    if (!post.hashtags.length) missing.push("ハッシュタグ");
    if (!post.thumbnailText.trim()) missing.push("サムネイル文字");

    if (post.scheduledDate === today) {
      notifications.push({
        sourceType: "post_schedule",
        sourceId: post.id,
        notificationType: "post_today",
        severity: missing.length ? "critical" : "warning",
        title: `本日投稿予定：${post.title}`,
        message: missing.length
          ? `本日投稿予定ですが、${missing.join("・")}が未設定です。`
          : `${post.scheduledTime?.slice(0, 5) ?? "時刻未設定"}に投稿予定です。`,
        actionUrl: "/post-schedules",
        dedupeKey: `post_today:${post.id}:${today}`,
      });
    }

    if (post.scheduledDate === tomorrow) {
      notifications.push({
        sourceType: "post_schedule",
        sourceId: post.id,
        notificationType: "post_tomorrow",
        severity: missing.length ? "warning" : "info",
        title: `明日投稿予定：${post.title}`,
        message: missing.length
          ? `明日の投稿に向けて、${missing.join("・")}を準備してください。`
          : "投稿準備は揃っています。最終確認をしてください。",
        actionUrl: "/post-schedules",
        dedupeKey: `post_tomorrow:${post.id}:${tomorrow}`,
      });
    }

    if (
      post.scheduledDate &&
      post.scheduledDate < today &&
      post.scheduleStatus !== "published"
    ) {
      notifications.push({
        sourceType: "post_schedule",
        sourceId: post.id,
        notificationType: "schedule_overdue",
        severity: "critical",
        title: `投稿予定日を超過：${post.title}`,
        message: `${post.scheduledDate}の予定が公開済みになっていません。状態を確認してください。`,
        actionUrl: "/post-schedules",
        dedupeKey: `schedule_overdue:${post.id}:${today}`,
      });
    }

    if (post.scheduledDate && missing.length >= 2) {
      notifications.push({
        sourceType: "post_schedule",
        sourceId: post.id,
        notificationType: "preparation_incomplete",
        severity: "warning",
        title: `投稿準備が不足：${post.title}`,
        message: `未設定項目：${missing.join("・")}`,
        actionUrl: "/post-schedules",
        dedupeKey: `preparation_incomplete:${post.id}:${today}`,
      });
    }
  }

  return notifications;
}

export function sortNotifications(
  notifications: OperationNotification[],
) {
  const severityOrder: Record<NotificationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;

    const severityDifference =
      severityOrder[a.severity] - severityOrder[b.severity];

    if (severityDifference !== 0) return severityDifference;

    return b.occurredAt.localeCompare(a.occurredAt);
  });
}
