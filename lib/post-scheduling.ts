export type ScheduleStatus =
  | "unscheduled"
  | "preparing"
  | "scheduled"
  | "published"
  | "cancelled";

export type ScheduledPost = {
  id: string;
  title: string;
  theme: string;
  postType: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduleStatus: ScheduleStatus;
  timezone: string;
  reminderEnabled: boolean;
  caption: string;
  thumbnailText: string;
  hashtags: string[];
  updatedAt: string;
};

export const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  unscheduled: "未設定",
  preparing: "準備中",
  scheduled: "予約済み",
  published: "公開済み",
  cancelled: "キャンセル",
};

export function isScheduleStatus(
  value: unknown,
): value is ScheduleStatus {
  return (
    value === "unscheduled" ||
    value === "preparing" ||
    value === "scheduled" ||
    value === "published" ||
    value === "cancelled"
  );
}

export function scheduleDateTime(post: ScheduledPost) {
  if (!post.scheduledDate) return null;

  const time = post.scheduledTime?.slice(0, 5) || "00:00";
  return `${post.scheduledDate}T${time}:00`;
}

export function sortScheduledPosts(posts: ScheduledPost[]) {
  return [...posts].sort((a, b) => {
    const left = scheduleDateTime(a);
    const right = scheduleDateTime(b);

    if (!left && !right) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    if (!left) return 1;
    if (!right) return -1;

    return left.localeCompare(right);
  });
}

export function postsForDate(
  posts: ScheduledPost[],
  date: string,
) {
  return sortScheduledPosts(
    posts.filter((post) => post.scheduledDate === date),
  );
}

export function findScheduleGaps(
  posts: ScheduledPost[],
  from: string,
  days: number,
  desiredPostsPerWeek = 3,
) {
  const start = new Date(`${from}T00:00:00`);
  const scheduledDates = new Set(
    posts
      .filter(
        (post) =>
          post.scheduleStatus !== "cancelled" &&
          Boolean(post.scheduledDate),
      )
      .map((post) => post.scheduledDate as string),
  );

  const result: Array<{
    weekStart: string;
    scheduledCount: number;
    missingCount: number;
    suggestedDates: string[];
  }> = [];

  for (let offset = 0; offset < days; offset += 7) {
    const weekDates: string[] = [];

    for (let day = 0; day < Math.min(7, days - offset); day += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + offset + day);
      weekDates.push(current.toISOString().slice(0, 10));
    }

    const occupied = weekDates.filter((date) =>
      scheduledDates.has(date),
    );
    const missingCount = Math.max(
      0,
      desiredPostsPerWeek - occupied.length,
    );

    const suggestedDates = weekDates
      .filter((date) => !scheduledDates.has(date))
      .filter((_, index) => index % 2 === 0)
      .slice(0, missingCount);

    result.push({
      weekStart: weekDates[0],
      scheduledCount: occupied.length,
      missingCount,
      suggestedDates,
    });
  }

  return result;
}

export function scheduleReadiness(post: ScheduledPost) {
  const checks = [
    {
      key: "date",
      label: "投稿予定日",
      complete: Boolean(post.scheduledDate),
    },
    {
      key: "time",
      label: "投稿時刻",
      complete: Boolean(post.scheduledTime),
    },
    {
      key: "caption",
      label: "キャプション",
      complete: post.caption.trim().length > 0,
    },
    {
      key: "hashtags",
      label: "ハッシュタグ",
      complete: post.hashtags.length > 0,
    },
    {
      key: "thumbnail",
      label: "サムネイル文字",
      complete: post.thumbnailText.trim().length > 0,
    },
  ];

  const completed = checks.filter((item) => item.complete).length;

  return {
    checks,
    completed,
    total: checks.length,
    percentage: Math.round((completed / checks.length) * 100),
  };
}
