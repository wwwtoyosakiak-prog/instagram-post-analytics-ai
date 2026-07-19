export type ManagerPriority = "critical" | "high" | "medium" | "low";

export type ManagerTask = {
  id: string;
  title: string;
  detail: string;
  priority: ManagerPriority;
  actionUrl: string;
};

export type ManagerResult = {
  today: string;
  score: {
    total: number;
    schedule: number;
    preparation: number;
    consistency: number;
    growth: number;
  };
  summary: {
    todayPosts: number;
    tomorrowPosts: number;
    overduePosts: number;
    unreadNotifications: number;
    incompletePosts: number;
    weekScheduledPosts: number;
    weekTarget: number;
    remainingPosts: number;
  };
  tasks: ManagerTask[];
  warnings: string[];
  coachContext: string;
};

type SchedulePost = {
  id: string;
  title: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduleStatus: string;
  caption: string;
  hashtags: string[];
  thumbnailText: string;
};

type Notification = {
  id: string;
  severity: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
};

type GrowthStrategy = {
  score: number;
  risks: string[];
};

export type ManagerInput = {
  today: string;
  schedules: SchedulePost[];
  notifications: Notification[];
  growthStrategy: GrowthStrategy | null;
  weekTarget?: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekRange(today: string) {
  const date = new Date(`${today}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const from = addDays(today, offset);
  return { from, to: addDays(from, 6) };
}

function readiness(post: SchedulePost) {
  const checks = [
    Boolean(post.scheduledDate),
    Boolean(post.scheduledTime),
    post.caption.trim().length > 0,
    post.hashtags.length > 0,
    post.thumbnailText.trim().length > 0,
  ];
  return Math.round(
    (checks.filter(Boolean).length / checks.length) * 100,
  );
}

function order(priority: ManagerPriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[
    priority
  ];
}

export function buildAiManager(
  input: ManagerInput,
): ManagerResult {
  const tomorrow = addDays(input.today, 1);
  const week = weekRange(input.today);
  const weekTarget = input.weekTarget ?? 3;

  const active = input.schedules.filter(
    (post) =>
      post.scheduleStatus !== "published" &&
      post.scheduleStatus !== "cancelled",
  );

  const todayPosts = active.filter(
    (post) => post.scheduledDate === input.today,
  );
  const tomorrowPosts = active.filter(
    (post) => post.scheduledDate === tomorrow,
  );
  const overduePosts = active.filter(
    (post) =>
      Boolean(post.scheduledDate) &&
      (post.scheduledDate as string) < input.today,
  );
  const weekPosts = active.filter(
    (post) =>
      Boolean(post.scheduledDate) &&
      (post.scheduledDate as string) >= week.from &&
      (post.scheduledDate as string) <= week.to,
  );
  const incompletePosts = active.filter(
    (post) => readiness(post) < 100,
  );
  const unread = input.notifications.filter(
    (item) => !item.isRead,
  );

  const tasks: ManagerTask[] = [];

  overduePosts.forEach((post) =>
    tasks.push({
      id: `overdue:${post.id}`,
      title: `投稿予定日を確認：${post.title}`,
      detail: `${post.scheduledDate}の投稿が公開済みになっていません。`,
      priority: "critical",
      actionUrl: "/post-schedules",
    }),
  );

  todayPosts.forEach((post) => {
    const rate = readiness(post);
    tasks.push({
      id: `today:${post.id}`,
      title: `${post.scheduledTime?.slice(0, 5) ?? "時刻未設定"}に投稿：${post.title}`,
      detail:
        rate === 100
          ? "公開前の最終確認をしてください。"
          : `準備率${rate}%です。不足項目を確認してください。`,
      priority: rate === 100 ? "high" : "critical",
      actionUrl: "/post-schedules",
    });
  });

  tomorrowPosts
    .filter((post) => readiness(post) < 100)
    .forEach((post) =>
      tasks.push({
        id: `tomorrow:${post.id}`,
        title: `明日の投稿準備：${post.title}`,
        detail: `準備率${readiness(post)}%です。今日中に整えてください。`,
        priority: "high",
        actionUrl: "/post-schedules",
      }),
    );

  unread
    .filter(
      (item) =>
        item.severity === "critical" ||
        item.severity === "warning",
    )
    .slice(0, 4)
    .forEach((item) =>
      tasks.push({
        id: `notification:${item.id}`,
        title: item.title,
        detail: item.message,
        priority:
          item.severity === "critical"
            ? "critical"
            : "high",
        actionUrl: item.actionUrl ?? "/notifications",
      }),
    );

  const remainingPosts = Math.max(
    0,
    weekTarget - weekPosts.length,
  );

  if (remainingPosts > 0) {
    tasks.push({
      id: "weekly-frequency",
      title: `今週あと${remainingPosts}投稿を計画`,
      detail: `目安${weekTarget}投稿に対して、現在${weekPosts.length}投稿です。`,
      priority: remainingPosts >= 2 ? "high" : "medium",
      actionUrl: "/post-planner",
    });
  }

  const preparation = active.length
    ? active.reduce((sum, post) => sum + readiness(post), 0) /
      active.length
    : 100;

  const scheduleScore = clamp(
    100 - overduePosts.length * 25,
  );
  const preparationScore = clamp(preparation);
  const consistencyScore = clamp(
    (weekPosts.length / Math.max(weekTarget, 1)) * 100,
  );
  const growthScore = clamp(input.growthStrategy?.score ?? 0);
  const total = clamp(
    scheduleScore * 0.3 +
      preparationScore * 0.25 +
      consistencyScore * 0.25 +
      growthScore * 0.2,
  );

  const sortedTasks = tasks
    .sort((a, b) => order(a.priority) - order(b.priority))
    .slice(0, 12);

  const warnings = [
    ...overduePosts.map(
      (post) =>
        `${post.title}は投稿予定日を超過しています。`,
    ),
    ...incompletePosts
      .filter(
        (post) =>
          post.scheduledDate === input.today ||
          post.scheduledDate === tomorrow,
      )
      .map(
        (post) =>
          `${post.title}の公開準備が完了していません。`,
      ),
    ...(input.growthStrategy?.risks ?? []).slice(0, 3),
  ].slice(0, 8);

  return {
    today: input.today,
    score: {
      total,
      schedule: scheduleScore,
      preparation: preparationScore,
      consistency: consistencyScore,
      growth: growthScore,
    },
    summary: {
      todayPosts: todayPosts.length,
      tomorrowPosts: tomorrowPosts.length,
      overduePosts: overduePosts.length,
      unreadNotifications: unread.length,
      incompletePosts: incompletePosts.length,
      weekScheduledPosts: weekPosts.length,
      weekTarget,
      remainingPosts,
    },
    tasks: sortedTasks,
    warnings,
    coachContext: [
      `本日の運用スコアは${total}点です。`,
      `本日投稿${todayPosts.length}件、明日投稿${tomorrowPosts.length}件、期限超過${overduePosts.length}件です。`,
      `今週は${weekPosts.length}/${weekTarget}件の投稿予定です。`,
      sortedTasks[0]
        ? `最優先は「${sortedTasks[0].title}」です。`
        : "緊急の運用タスクはありません。",
    ].join("\n"),
  };
}
