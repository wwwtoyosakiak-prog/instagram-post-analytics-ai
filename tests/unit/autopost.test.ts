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

describe("autopost weekly series", () => {
  it("曜日ごとに連載とスタイルが決まる", async () => {
    const { seriesForDate, nextDate } = await import("@/lib/autopost");
    expect(seriesForDate("2026-11-16").style).toBe("kraft"); // 月
    expect(seriesForDate("2026-11-19").style).toBe("ranking"); // 木
    expect(seriesForDate("2026-11-22").style).toBe("story"); // 日
    expect(nextDate("2026-11-30")).toBe("2026-12-01");
  });

  it("連載のスタイルと予告はAIの出力より優先される", () => {
    const plan = sanitizePlan({ style: "dark", photos: ["a"], lines: ["x"], hashtags: [], tomorrowTeaser: "ちがう予告" }, photos, [], "ranking", "ペパポン図鑑");
    expect(plan.style).toBe("ranking");
    expect(plan.tomorrowTeaser).toBe("ペパポン図鑑");
    expect(plan.photos.length).toBeGreaterThanOrEqual(3);
  });
});
