import { describe, expect, it } from "vitest";
import {
  buildPostPlannerPrompt,
  normalizePostPlannerResult,
} from "@/lib/post-planner";

describe("post planner", () => {
  it("入力条件をプロンプトへ含める", () => {
    const prompt = buildPostPlannerPrompt({
      goal: "saves",
      postType: "reel",
      theme: "段ボール工作",
      audience: "保護者",
      keyMessage: "家庭でも楽しめる",
      tone: "親しみやすい",
    });

    expect(prompt).toContain("段ボール工作");
    expect(prompt).toContain("保護者");
    expect(prompt).toContain("reel");
  });

  it("AI回答を正規化する", () => {
    const result = normalizePostPlannerResult({
      title: "工作企画",
      concept: "制作工程を紹介",
      hook: "これ、段ボールです",
      reelScript: [
        {
          order: 1,
          timing: "0〜3秒",
          visual: "完成品",
          narration: "完成しました",
          textOverlay: "段ボール工作",
        },
      ],
      caption: "完成版",
      hashtags: ["#工作"],
    });

    expect(result.title).toBe("工作企画");
    expect(result.reelScript).toHaveLength(1);
    expect(result.hashtags).toEqual(["#工作"]);
  });
});
