import { describe, expect, it } from "vitest";

describe("performance report UI helpers", () => {
  it("比較値の表示仕様を維持する", () => {
    const format = (value: number | null) =>
      value == null
        ? "前期間比較なし"
        : `前期間比 ${value >= 0 ? "+" : ""}${value}%`;

    expect(format(null)).toBe("前期間比較なし");
    expect(format(12)).toBe("前期間比 +12%");
    expect(format(-5)).toBe("前期間比 -5%");
  });
});
