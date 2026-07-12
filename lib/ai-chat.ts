import type { AiScoreHistory, InstagramPost } from "@/lib/types";

export type AiChatContext = {
  posts: InstagramPost[];
  scoreHistory: AiScoreHistory[];
  accountId?: string;
};

function latestHistoryByPost(history: AiScoreHistory[]) {
  const latest = new Map<string, AiScoreHistory>();

  for (const item of history) {
    const current = latest.get(item.postId);
    if (!current || current.createdAt < item.createdAt) {
      latest.set(item.postId, item);
    }
  }

  return latest;
}

export function buildAiChatContext({
  posts,
  scoreHistory,
  accountId,
}: AiChatContext) {
  const filtered = accountId
    ? posts.filter((post) => post.accountId === accountId)
    : posts;

  const latestByPost = latestHistoryByPost(scoreHistory);

  return filtered
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100)
    .map((post) => {
      const score = latestByPost.get(post.id);

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
        reach: post.latestInsight?.reach ?? null,
        profileVisits: post.latestInsight?.profileVisits ?? null,
        follows: post.latestInsight?.follows ?? null,
        aiScore: score?.score ?? null,
        scoreBreakdown: score
          ? {
              content: score.contentScore,
              visual: score.visualScore,
              caption: score.captionScore,
              engagement: score.engagementScore,
              discoverability: score.discoverabilityScore,
            }
          : null,
      };
    });
}

export function buildAiChatPrompt(
  question: string,
  context: ReturnType<typeof buildAiChatContext>,
) {
  return `あなたはInstagram運用データを分析するAIアシスタントです。
ユーザーの質問に、以下の投稿データだけを根拠として日本語で答えてください。

# ルール
- データに存在しない情報を創作しない。
- 数値を使うときは、どの投稿・期間・指標を見たか分かるようにする。
- 投稿数が少ない場合は断定しない。
- 「改善する」だけで終わらず、次回投稿で実行できる具体案を示す。
- 最後に「根拠」と「次の行動」を短く分けて書く。
- 回答はMarkdownでよい。
- 個人情報やAPIキーについて推測しない。

# 質問
${question}

# 投稿データ
${JSON.stringify(context, null, 2)}`;
}
