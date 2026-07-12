import { describe, expect, it } from "vitest";
import {
  filterPostPlans,
  isPostPlanStatus,
  type SavedPostPlan,
} from "@/lib/post-plan-history";

const plan: SavedPostPlan = {
  id: "1",
  title: "段ボール工作",
  status: "draft",
  scheduledDate: null,
  input: {
    goal: "reach",
    postType: "reel",
    theme: "ガチャ制作",
    audience: "保護者",
    keyMessage: "家庭でも楽しめる",
    tone: "親しみやすい",
  },
  result: {
    title: "段ボール工作",
    concept: "工程紹介",
    hook: "これ段ボールです",
    reelScript: [],
    carouselSlides: [],
    caption: "制作工程を紹介します",
    shortCaption: "工作紹介",
    hashtags: ["#工作"],
    callToAction: "保存してください",
    thumbnailText: "工作に挑戦",
    productionChecklist: [],
    cautions: [],
  },
  createdAt: "2026-07-13T00:00:00Z",
  updatedAt: "2026-07-13T00:00:00Z",
};

describe("post plan history", () => {
  it("状態を検証する", () => {
    expect(isPostPlanStatus("draft")).toBe(true);
    expect(isPostPlanStatus("unknown")).toBe(false);
  });

  it("キーワードと状態で絞り込む", () => {
    expect(filterPostPlans([plan], "ガチャ", "all")).toHaveLength(1);
    expect(filterPostPlans([plan], "", "posted")).toHaveLength(0);
  });
});
