export type GrowthPost = {
  id: string;
  date: string;
  type: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

export type GrowthMetric = {
  label: string;
  value: number;
  postCount: number;
};

export type GrowthStrategyResult = {
  score: number;
  period: {
    from: string | null;
    to: string | null;
    days: number;
  };
  summary: {
    postCount: number;
    postsPerWeek: number;
    averageViews: number;
    averageEngagementRate: number;
    averageSaveRate: number;
    averageShareRate: number;
  };
  contentMix: Array<{
    type: string;
    count: number;
    percentage: number;
    averageViews: number;
  }>;
  weekdayPerformance: GrowthMetric[];
  hourPerformance: GrowthMetric[];
  topPosts: GrowthPost[];
  bottomPosts: GrowthPost[];
  strengths: string[];
  risks: string[];
  roadmap: Array<{
    week: number;
    focus: string;
    actions: string[];
    measurement: string;
  }>;
};

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) /
        values.length
    : 0;
}

function interactionCount(post: GrowthPost) {
  return (
    post.likes +
    post.comments +
    post.saves +
    post.shares
  );
}

function engagementRate(post: GrowthPost) {
  return post.views > 0
    ? (interactionCount(post) / post.views) * 100
    : 0;
}

function saveRate(post: GrowthPost) {
  return post.views > 0
    ? (post.saves / post.views) * 100
    : 0;
}

function shareRate(post: GrowthPost) {
  return post.views > 0
    ? (post.shares / post.views) * 100
    : 0;
}

function postScore(post: GrowthPost) {
  return (
    post.views * 0.25 +
    post.likes * 1 +
    post.comments * 3 +
    post.saves * 4 +
    post.shares * 5
  );
}

export function normalizeGrowthPosts(
  value: unknown,
): GrowthPost[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): GrowthPost | null => {
      const row =
        item && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {};

      const id = String(row.id ?? "").trim();
      const date = String(row.date ?? "").slice(0, 19);

      if (!id || !date) return null;

      return {
        id,
        date,
        type: String(
          row.type ?? row.mediaType ?? "unknown",
        ).toLowerCase(),
        caption: String(row.caption ?? ""),
        views: safeNumber(
          row.views ??
            row.plays ??
            row.reach ??
            row.impressions,
        ),
        likes: safeNumber(row.likes),
        comments: safeNumber(row.comments),
        saves: safeNumber(row.saves),
        shares: safeNumber(row.shares),
      };
    })
    .filter((item): item is GrowthPost => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculatePeriod(posts: GrowthPost[]) {
  if (!posts.length) {
    return {
      from: null,
      to: null,
      days: 0,
    };
  }

  const from = posts[0].date.slice(0, 10);
  const to = posts[posts.length - 1].date.slice(0, 10);
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const days = Math.max(
    1,
    Math.floor(
      (toDate.getTime() - fromDate.getTime()) /
        86_400_000,
    ) + 1,
  );

  return { from, to, days };
}

function buildContentMix(posts: GrowthPost[]) {
  const groups = new Map<string, GrowthPost[]>();

  for (const post of posts) {
    const type = post.type || "unknown";
    groups.set(type, [...(groups.get(type) ?? []), post]);
  }

  return [...groups.entries()]
    .map(([type, items]) => ({
      type,
      count: items.length,
      percentage: round(
        (items.length / Math.max(posts.length, 1)) * 100,
      ),
      averageViews: Math.round(
        average(items.map((post) => post.views)),
      ),
    }))
    .sort((a, b) => b.count - a.count);
}

const weekdayLabels = [
  "日",
  "月",
  "火",
  "水",
  "木",
  "金",
  "土",
];

function buildWeekdayPerformance(posts: GrowthPost[]) {
  const groups = new Map<number, GrowthPost[]>();

  for (const post of posts) {
    const date = new Date(post.date);
    if (Number.isNaN(date.getTime())) continue;

    const day = date.getDay();
    groups.set(day, [...(groups.get(day) ?? []), post]);
  }

  return [...groups.entries()]
    .map(([day, items]) => ({
      label: `${weekdayLabels[day]}曜日`,
      value: Math.round(
        average(items.map((post) => postScore(post))),
      ),
      postCount: items.length,
    }))
    .sort((a, b) => b.value - a.value);
}

function hourBand(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "時刻不明";

  const hour = parsed.getHours();

  if (hour < 6) return "0〜5時";
  if (hour < 10) return "6〜9時";
  if (hour < 13) return "10〜12時";
  if (hour < 17) return "13〜16時";
  if (hour < 20) return "17〜19時";
  if (hour < 23) return "20〜22時";
  return "23時";
}

function buildHourPerformance(posts: GrowthPost[]) {
  const groups = new Map<string, GrowthPost[]>();

  for (const post of posts) {
    const band = hourBand(post.date);
    groups.set(band, [...(groups.get(band) ?? []), post]);
  }

  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      value: Math.round(
        average(items.map((post) => postScore(post))),
      ),
      postCount: items.length,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildInsights(
  posts: GrowthPost[],
  postsPerWeek: number,
  averageSaveRate: number,
  averageShareRate: number,
  contentMix: GrowthStrategyResult["contentMix"],
  weekdayPerformance: GrowthMetric[],
) {
  const strengths: string[] = [];
  const risks: string[] = [];

  if (postsPerWeek >= 3) {
    strengths.push(
      `投稿頻度は週${postsPerWeek}本で、継続運用できています。`,
    );
  } else {
    risks.push(
      `投稿頻度は週${postsPerWeek}本です。まず週3本を安定して続けられる制作体制を優先してください。`,
    );
  }

  if (averageSaveRate >= 2) {
    strengths.push(
      `平均保存率は${averageSaveRate}%で、後から見返したい内容を作れています。`,
    );
  } else {
    risks.push(
      `平均保存率は${averageSaveRate}%です。手順・比較・チェックリスト形式を増やす余地があります。`,
    );
  }

  if (averageShareRate >= 1) {
    strengths.push(
      `平均シェア率は${averageShareRate}%で、人に紹介される投稿が含まれています。`,
    );
  } else {
    risks.push(
      `平均シェア率は${averageShareRate}%です。驚き・共感・役立つ情報のどれを狙うか明確にしてください。`,
    );
  }

  const dominant = contentMix[0];

  if (dominant && dominant.percentage >= 80) {
    risks.push(
      `${dominant.type}が投稿全体の${dominant.percentage}%を占めています。別形式を少量テストし、成果差を確認してください。`,
    );
  } else if (contentMix.length >= 2) {
    strengths.push(
      `投稿形式が${contentMix.length}種類あり、形式の比較ができます。`,
    );
  }

  const bestDay = weekdayPerformance[0];

  if (bestDay && bestDay.postCount >= 2) {
    strengths.push(
      `${bestDay.label}は成果スコアが最も高い曜日です。ただし投稿数${bestDay.postCount}件の結果なので、継続検証が必要です。`,
    );
  }

  if (posts.length < 10) {
    risks.push(
      "分析対象が10件未満のため、曜日・時間帯の結果は暫定評価です。",
    );
  }

  return {
    strengths: strengths.slice(0, 5),
    risks: risks.slice(0, 5),
  };
}

function calculateGrowthScore(input: {
  postCount: number;
  postsPerWeek: number;
  averageEngagementRate: number;
  averageSaveRate: number;
  averageShareRate: number;
  contentTypes: number;
}) {
  const frequencyScore = Math.min(
    25,
    (input.postsPerWeek / 4) * 25,
  );
  const engagementScore = Math.min(
    25,
    (input.averageEngagementRate / 8) * 25,
  );
  const saveScore = Math.min(
    20,
    (input.averageSaveRate / 3) * 20,
  );
  const shareScore = Math.min(
    15,
    (input.averageShareRate / 1.5) * 15,
  );
  const diversityScore = Math.min(
    10,
    (input.contentTypes / 3) * 10,
  );
  const sampleScore = Math.min(
    5,
    (input.postCount / 20) * 5,
  );

  return Math.round(
    frequencyScore +
      engagementScore +
      saveScore +
      shareScore +
      diversityScore +
      sampleScore,
  );
}

function buildRoadmap(result: {
  bestType: string | null;
  bestDay: string | null;
  postsPerWeek: number;
  saveRate: number;
  shareRate: number;
}) {
  const targetFrequency = Math.max(
    3,
    Math.ceil(result.postsPerWeek),
  );

  return [
    {
      week: 1,
      focus: "再現性の確認",
      actions: [
        result.bestType
          ? `${result.bestType}形式で上位投稿に近いテーマを1本作る`
          : "過去投稿を整理し、基準となる投稿を決める",
        result.bestDay
          ? `${result.bestDay}に投稿し、曜日効果を再検証する`
          : "投稿曜日と時刻を必ず記録する",
      ],
      measurement:
        "表示数・保存率・シェア率を直近平均と比較",
    },
    {
      week: 2,
      focus: "保存される内容の強化",
      actions: [
        "手順・チェックリスト・比較のいずれかを投稿に入れる",
        "CTAは『保存して後で試す』のように行動を1つに絞る",
      ],
      measurement: `保存率${Math.max(
        round(result.saveRate * 1.1),
        1,
      )}%を目安に比較`,
    },
    {
      week: 3,
      focus: "シェアされる理由の検証",
      actions: [
        "冒頭で驚き・共感・役立つ情報のどれを提供するか明示する",
        "同じテーマでフックだけ変えた投稿を比較する",
      ],
      measurement: `シェア率${Math.max(
        round(result.shareRate * 1.1),
        0.5,
      )}%を目安に比較`,
    },
    {
      week: 4,
      focus: "勝ちパターンの整理",
      actions: [
        `週${targetFrequency}本を無理なく続けられたか確認する`,
        "上位投稿の共通点を3つ、下位投稿の共通点を3つ記録する",
        "翌月に継続する形式・曜日・テーマを決める",
      ],
      measurement:
        "4週間平均と開始前平均を比較し、改善した指標だけ継続",
    },
  ];
}

export function buildGrowthStrategy(
  posts: GrowthPost[],
): GrowthStrategyResult {
  const period = calculatePeriod(posts);
  const postCount = posts.length;
  const postsPerWeek =
    period.days > 0
      ? round((postCount / period.days) * 7)
      : 0;

  const averageViews = Math.round(
    average(posts.map((post) => post.views)),
  );
  const averageEngagementRate = round(
    average(posts.map(engagementRate)),
  );
  const averageSaveRate = round(
    average(posts.map(saveRate)),
  );
  const averageShareRate = round(
    average(posts.map(shareRate)),
  );

  const contentMix = buildContentMix(posts);
  const weekdayPerformance =
    buildWeekdayPerformance(posts);
  const hourPerformance = buildHourPerformance(posts);

  const ranked = [...posts].sort(
    (a, b) => postScore(b) - postScore(a),
  );

  const selectionCount = Math.max(
    1,
    Math.ceil(posts.length * 0.1),
  );

  const topPosts = ranked.slice(0, selectionCount);
  const bottomPosts = ranked
    .slice(-selectionCount)
    .reverse();

  const insights = buildInsights(
    posts,
    postsPerWeek,
    averageSaveRate,
    averageShareRate,
    contentMix,
    weekdayPerformance,
  );

  const score = calculateGrowthScore({
    postCount,
    postsPerWeek,
    averageEngagementRate,
    averageSaveRate,
    averageShareRate,
    contentTypes: contentMix.length,
  });

  return {
    score,
    period,
    summary: {
      postCount,
      postsPerWeek,
      averageViews,
      averageEngagementRate,
      averageSaveRate,
      averageShareRate,
    },
    contentMix,
    weekdayPerformance,
    hourPerformance,
    topPosts,
    bottomPosts,
    strengths: insights.strengths,
    risks: insights.risks,
    roadmap: buildRoadmap({
      bestType: contentMix[0]?.type ?? null,
      bestDay: weekdayPerformance[0]?.label ?? null,
      postsPerWeek,
      saveRate: averageSaveRate,
      shareRate: averageShareRate,
    }),
  };
}
