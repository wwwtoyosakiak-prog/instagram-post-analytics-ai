import { describe, expect, it } from "vitest";
import { normalizeAiAnalysis } from "@/lib/ai-analysis";

describe("caption suggestion v2", () => {
  it("複数キャプション案を正規化する", () => {
    const result = normalizeAiAnalysis({
      captionSuggestion: {
        hook: "おすすめ",
        hookOptions: ["案1", "案2", "案3"],
        improvedCaption: "通常版",
        shortVersion: "短文版",
        reelVersion: "リール版",
        ctaStrongVersion: "CTA版",
        callToAction: "質問",
        ctaOptions: ["質問", "保存", "共有"],
        changes: ["冒頭変更"],
        strategy: "構成理由",
      },
    });

    expect(result.captionSuggestion?.hookOptions).toHaveLength(3);
    expect(result.captionSuggestion?.reelVersion).toBe("リール版");
    expect(result.captionSuggestion?.ctaStrongVersion).toBe("CTA版");
    expect(result.captionSuggestion?.ctaOptions).toEqual(["質問", "保存", "共有"]);
    expect(result.captionSuggestion?.strategy).toBe("構成理由");
  });

  it("旧形式のキャプションも維持する", () => {
    const result = normalizeAiAnalysis({
      captionSuggestion: {
        hook: "冒頭",
        improvedCaption: "本文",
        shortVersion: "短文",
        callToAction: "CTA",
        changes: [],
      },
    });

    expect(result.captionSuggestion?.improvedCaption).toBe("本文");
    expect(result.captionSuggestion?.hookOptions).toEqual([]);
  });
});
