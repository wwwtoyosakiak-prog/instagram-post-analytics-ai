import { describe, expect, it } from "vitest";
import { getDataFreshness } from "@/lib/data-freshness";

describe("data freshness", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it("同期時刻から鮮度を分かりやすく分類する", () => {
    expect(getDataFreshness("2026-08-02T08:00:00.000Z", now).label).toBe("最新");
    expect(getDataFreshness("2026-08-01T18:00:00.000Z", now).label).toBe("本日更新");
    expect(getDataFreshness("2026-07-30T12:00:00.000Z", now).label).toBe("更新が必要");
    expect(getDataFreshness(null, now).label).toBe("未同期");
  });
});
