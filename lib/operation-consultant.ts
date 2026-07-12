import type { AiScoreHistory, InstagramPost } from "@/lib/types";

export type ConsultantPriority = {
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  action: string;
};

export type ConsultantCalendarItem = {
  day: string;
  postType: "reel" | "carousel" | "image" | "video" | "rest";
  theme: string;
  purpose: string;
};

export type OperationConsultantResult = {
  weeklySummary: string;
  priorities: ConsultantPriority[];
  contentThemes: string[];
  weeklyCalendar: ConsultantCalendarItem[];
  expectedEffects: string[];
  cautions: string[];
  evidence: string[];
};

export type OperationConsultantContext = {
  period: {
    from: string;
    to: string;
  };
  posts: Array<{
    id: string;
    date: string;
    type: string;
    caption: string;
    hashtags: string;
    views: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    engagementRate: number;
    aiScore: number | null;
  }>;
  summary: {
    postCount: number;
    averageViews: number;
    averageEngagementRate: number;
    averageSaveRate: number;
    averageAiScore: number;
    topPostType: string | null;
  };
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function latestScoreMap(history: AiScoreHistory[]) {
  const result = new Map<string, AiScoreHistory>();

  for (const item of history) {
    const current = result.get(item.postId);
    if (!current || current.createdAt < item.createdAt) {
      result.set(item.postId, item);
    }
  }

  return result;
}

export function buildOperationConsultantContext(
  posts: InstagramPost[],
  scoreHistory: AiScoreHistory[],
  from: string,
  to: string,
  accountId?: string,
): OperationConsultantContext {
  const scores = latestScoreMap(scoreHistory);
  const selectedPosts = posts
    .filter((post) => (!accountId || post.accountId === accountId))
    .filter((post) => post.date >= from && post.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100);

  const mappedPosts = selectedPosts.map((post) => {
    const interactions =
      post.likes + post.comments + post.saves + post.shares;

    return {
      id: post.id,
      date: post.date,
      type: post.type,
      caption: post.caption,
      hashtags: post.hashtags,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      saves: post.saves,
      shares: post.shares,
      engagementRate:
        post.views > 0 ? round((interactions / post.views) * 100) : 0,
      aiScore: scores.get(post.id)?.score ?? null,
    };
  });

  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

  const typeCounts = new Map<string, number>();
  for (const post of mappedPosts) {
    typeCounts.set(post.type, (typeCounts.get(post.type) ?? 0) + 1);
  }

  const aiScores = mappedPosts
    .map((post) => post.aiScore)
    .filter((value): value is number => typeof value === "number");

  return {
    period: { from, to },
    posts: mappedPosts,
    summary: {
      postCount: mappedPosts.length,
      averageViews: round(average(mappedPosts.map((post) => post.views))),
      averageEngagementRate: round(
        average(mappedPosts.map((post) => post.engagementRate)),
      ),
      averageSaveRate: round(
        average(
          mappedPosts.map((post) =>
            post.views > 0 ? (post.saves / post.views) * 100 : 0,
          ),
        ),
      ),
      averageAiScore: round(average(aiScores), 1),
      topPostType:
        [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        null,
    },
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 12)
    : [];
}

export function normalizeOperationConsultantResult(
  value: unknown,
): OperationConsultantResult {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const priorities = Array.isArray(source.priorities)
    ? source.priorities
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          const priority =
            row.priority === "high" ||
            row.priority === "medium" ||
            row.priority === "low"
              ? row.priority
              : "medium";

          return {
            priority,
            title: text(row.title),
            reason: text(row.reason),
            action: text(row.action),
          };
        })
        .filter((item) => item.title && item.action)
        .slice(0, 8)
    : [];

  const weeklyCalendar = Array.isArray(source.weeklyCalendar)
    ? source.weeklyCalendar
        .map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          const allowed = [
            "reel",
            "carousel",
            "image",
            "video",
            "rest",
          ] as const;
          const rawType = text(row.postType);
          const postType = allowed.includes(
            rawType as (typeof allowed)[number],
          )
            ? (rawType as (typeof allowed)[number])
            : "rest";

          return {
            day: text(row.day),
            postType,
            theme: text(row.theme),
            purpose: text(row.purpose),
          };
        })
        .filter((item) => item.day)
        .slice(0, 7)
    : [];

  return {
    weeklySummary: text(source.weeklySummary),
    priorities,
    contentThemes: textArray(source.contentThemes),
    weeklyCalendar,
    expectedEffects: textArray(source.expectedEffects),
    cautions: textArray(source.cautions),
    evidence: textArray(source.evidence),
  };
}

export function buildOperationConsultantPrompt(
  context: OperationConsultantContext,
) {
  return `あなたはInstagram運用コンサルタントです。
以下の期間データだけを根拠に、次の7日間で実行できる運用計画を日本語で作成してください。

重要ルール:
- 入力に存在しないフォロワー属性、競合情報、最適時刻を創作しない。
- 投稿数が3件未満なら暫定評価と明記する。
- 成長率や将来の再生数を保証しない。
- 優先課題は理由と具体的行動をセットにする。
- 投稿カレンダーは7日分。毎日投稿を強制せず、休息日も設定可能。
- 出力はJSONオブジェクトのみ。

分析データ:
${JSON.stringify(context, null, 2)}

出力形式:
{
  "weeklySummary": "今週の総評を3〜5文",
  "priorities": [
    {
      "priority": "high | medium | low",
      "title": "改善項目",
      "reason": "数値に基づく理由",
      "action": "次の投稿で行う具体策"
    }
  ],
  "contentThemes": ["次に試す投稿テーマを3〜6件"],
  "weeklyCalendar": [
    {
      "day": "月曜日",
      "postType": "reel | carousel | image | video | rest",
      "theme": "テーマまたは休息",
      "purpose": "狙い"
    }
  ],
  "expectedEffects": ["期待できる効果。保証表現は禁止"],
  "cautions": ["データ不足や運用上の注意"],
  "evidence": ["判断に使った数値根拠"]
}`;
}
