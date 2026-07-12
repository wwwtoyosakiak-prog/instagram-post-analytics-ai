import { describe, expect, it } from "vitest";
import { buildAiChatContext, buildAiChatPrompt } from "@/lib/ai-chat";
import type { AiScoreHistory, InstagramPost } from "@/lib/types";

const post: InstagramPost = {
  id: "p1",
  accountId: "a1",
  date: "2026-07-12",
  recordedDate: "2026-07-12",
  url: "",
  caption: "段ボール工作",
  hashtags: "#工作",
  type: "reel",
  mediaCount: 1,
  likes: 10,
  comments: 2,
  saves: 4,
  shares: 1,
  views: 100,
  memo: "",
  createdAt: "",
  updatedAt: "",
};

const score: AiScoreHistory = {
  id: 1,
  postId: "p1",
  analysisId: "x1",
  score: 82,
  contentScore: 17,
  visualScore: 16,
  captionScore: 15,
  engagementScore: 18,
  discoverabilityScore: 16,
  createdAt: "2026-07-12T00:00:00Z",
};

describe("AI chat context", () => {
  it("投稿と最新スコアを統合する", () => {
    const context = buildAiChatContext({
      posts: [post],
      scoreHistory: [score],
    });

    expect(context[0].aiScore).toBe(82);
    expect(context[0].type).toBe("reel");
  });

  it("質問とデータをプロンプトに含める", () => {
    const context = buildAiChatContext({
      posts: [post],
      scoreHistory: [score],
    });

    const prompt = buildAiChatPrompt("保存率は？", context);
    expect(prompt).toContain("保存率は？");
    expect(prompt).toContain("段ボール工作");
    expect(prompt).toContain("82");
  });
});
