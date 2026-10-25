import { describe, expect, it } from "vitest";
import { sanitizePlan } from "@/lib/autopost";

const photos = ["a", "b", "c", "d", "e"].map((id) => ({ id, tags: [] }));

describe("autopost plan sanitizer", () => {
  it("存在しない写真を除いて4枚以上にそろえ、必須ハッシュタグを入れる", () => {
    const plan = sanitizePlan({
      style: "dark", theme: "作品コレクションだよ〜〜〜〜〜", lines: ["No.01"], photos: ["b", "zzz", "b"],
      quizId: "q1", tomorrowTeaser: "SDGs", caption: "みてね", hashtags: ["#だんボール", "ペパポン"],
    }, photos, ["q1"]);
    expect(plan.style).toBe("dark");
    expect(plan.photos[0]).toBe("b");
    expect(plan.photos).not.toContain("zzz");
    expect(plan.photos.length).toBeGreaterThanOrEqual(4);
    expect(Array.from(plan.theme).length).toBeLessThanOrEqual(12);
    expect(plan.quizId).toBeNull();
    expect(plan.hashtags.slice(0, 2)).toEqual(["ペパポン", "新西ゼミ"]);
    expect(plan.hashtags).toContain("だんボール");
  });

  it("クイズ一覧にないクイズは使わず pop にもどす", () => {
    const plan = sanitizePlan({ style: "quiz", quizId: "made-up", photos: [], lines: [], hashtags: [] }, photos, ["q1"]);
    expect(plan.style).toBe("pop");
    expect(plan.quizId).toBeNull();
  });

  it("正しいクイズIDはそのまま使う", () => {
    const plan = sanitizePlan({ style: "quiz", quizId: "q1", photos: ["a"], lines: ["Q"], hashtags: [] }, photos, ["q1"]);
    expect(plan.style).toBe("quiz");
    expect(plan.quizId).toBe("q1");
  });
});
