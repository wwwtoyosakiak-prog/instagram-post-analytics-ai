import { describe, expect, it } from "vitest";
import { getSyncRecovery } from "@/lib/sync-recovery";

describe("sync recovery guidance", () => {
  it("エラー原因ごとに次の操作を案内する", () => {
    expect(getSyncRecovery("401 access token expired").href).toBe("/token-management");
    expect(getSyncRecovery("429 rate limit").nextAction).toContain("10分");
    expect(getSyncRecovery("database column missing").actionLabel).toBe("準備状況を確認");
  });
});
