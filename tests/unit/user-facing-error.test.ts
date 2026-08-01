import { describe, expect, it } from "vitest";
import { toUserFacingError } from "@/lib/user-facing-error";

describe("user-facing errors", () => {
  it("does not expose technical database details", () => {
    const message = toUserFacingError(new Error("Supabase relation public.instagram_posts does not exist"), "sync");
    expect(message).not.toContain("Supabase");
    expect(message).not.toContain("instagram_posts");
    expect(message).toContain("保存先");
  });

  it("gives a clear next action for authentication errors", () => {
    const message = toUserFacingError(new Error("Graph API returned 401 unauthorized access token"), "sync");
    expect(message).toContain("Instagram連携画面");
  });

  it("uses a short context-specific fallback", () => {
    expect(toUserFacingError(new Error("unexpected internal detail"), "analysis")).toContain("分析を完了できませんでした");
  });
});
