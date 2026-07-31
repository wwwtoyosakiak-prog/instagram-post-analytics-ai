import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as analyzeGrowth } from "@/app/api/instagram/growth-analysis/route";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/server-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI API request validation", () => {
  it("returns 400 for malformed JSON", async () => {
    const response = await analyzePost(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "リクエストの形式が正しくありません。" });
  });

  it("returns 400 for an unsupported growth period", async () => {
    const response = await analyzeGrowth(new Request("http://localhost/api/instagram/growth-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: [], period: "year" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "分析期間が正しくありません。" });
  });
});

describe("external API response handling", () => {
  it("rejects a response that is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));

    await expect(fetchJsonWithTimeout("https://example.com")).rejects.toMatchObject({
      status: 502,
      message: "外部サービスから正しい応答を受け取れませんでした。",
    });
  });

  it("returns a timeout error when the external service does not respond", async () => {
    vi.stubGlobal("fetch", vi.fn((_input: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));

    await expect(fetchJsonWithTimeout("https://example.com", {}, 1)).rejects.toEqual(
      new ApiRequestError("外部サービスの応答がタイムアウトしました。もう一度お試しください。", 504),
    );
  });
});
