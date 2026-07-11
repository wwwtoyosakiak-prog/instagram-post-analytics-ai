import { describe, expect, it } from "vitest";
import { getSyncErrorRate, getSyncStatus } from "@/lib/sync-result";

describe("Instagram同期結果", () => {
  it("失敗がなければsuccess", () => {
    expect(getSyncStatus({ fetchedPosts: 10, savedPosts: 10, savedSnapshots: 10, failedPosts: 0 })).toBe("success");
  });

  it("一部保存できた場合はpartial", () => {
    expect(getSyncStatus({ fetchedPosts: 10, savedPosts: 8, savedSnapshots: 8, failedPosts: 2 })).toBe("partial");
    expect(getSyncErrorRate({ fetchedPosts: 10, savedPosts: 8, savedSnapshots: 8, failedPosts: 2 })).toBe(0.2);
  });

  it("何も保存できなければfailed", () => {
    expect(getSyncStatus({ fetchedPosts: 3, savedPosts: 0, savedSnapshots: 0, failedPosts: 3 })).toBe("failed");
  });
});
