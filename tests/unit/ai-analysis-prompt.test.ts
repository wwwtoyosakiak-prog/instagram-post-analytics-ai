import { describe, expect, it } from "vitest";
import { buildAiAnalysisPrompt } from "@/lib/ai-analysis-prompt";
import type { InstagramPost } from "@/lib/types";

function createPost(overrides: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: "post-1",
    accountId: "account-1",
    date: "2026-07-11",
    recordedDate: "2026-07-11",
    url: "",
    caption: "段ボールガチャを作りました。",
    hashtags: "#ペパポン #段ボール工作",
    type: "reel",
    mediaCount: 1,
    likes: 20,
    comments: 2,
    saves: 5,
    shares: 3,
    views: 500,
    memo: "",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildAiAnalysisPrompt", () => {
  it("数値とアカウント方針をプロンプトへ含める", () => {
    const prompt = buildAiAnalysisPrompt(createPost(), {
      id: "account-1",
      name: "ペパポンラボ",
      username: "pepapon",
      instagramApiUsername: "pepapon",
      profileUrl: "",
      industry: "教育・工作",
      targetAudience: "子どもと保護者",
      goal: "イベント認知",
      openaiApiKeyEnvName: "",
      openaiModel: "",
      analysisInstructions: "保存される投稿を重視",
      memo: "",
      createdAt: "",
      updatedAt: "",
    });

    expect(prompt).toContain("ペパポンラボ");
    expect(prompt).toContain("保存される投稿を重視");
    expect(prompt).toContain("表示数: 500");
    expect(prompt).toContain("保存率: 1.00%");
  });

  it("リール固有の評価基準を含める", () => {
    const prompt = buildAiAnalysisPrompt(createPost({ type: "reel" }));
    expect(prompt).toContain("冒頭1〜3秒");
    expect(prompt).toContain("平均視聴時間");
  });

  it("単一投稿から時間を断定しないルールを含める", () => {
    const prompt = buildAiAnalysisPrompt(createPost());
    expect(prompt).toContain("単一投稿だけから");
    expect(prompt).toContain("general_tendency");
    expect(prompt).toContain("confidence");
  });

  it("画像がないことを明示する", () => {
    const prompt = buildAiAnalysisPrompt(createPost({
      screenshot: undefined,
      mediaUrl: undefined,
      thumbnailUrl: undefined,
    }));
    expect(prompt).toContain("分析可能な画像・サムネイル: なし");
    expect(prompt).toContain("画像を確認できない場合");
  });
});
