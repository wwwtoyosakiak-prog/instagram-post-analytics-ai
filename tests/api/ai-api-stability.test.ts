import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as analyzeGrowth } from "@/app/api/instagram/growth-analysis/route";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/server-api";
import type { InstagramPost } from "@/lib/types";

const post: InstagramPost = {
  id: "post-1",
  date: "2026-08-01",
  recordedDate: "2026-08-01",
  url: "",
  caption: "テスト投稿",
  hashtags: "#test",
  type: "reel",
  mediaCount: 1,
  likes: 10,
  comments: 2,
  saves: 3,
  shares: 1,
  views: 100,
  memo: "",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it("returns 400 when the OpenAI API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await analyzePost(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("OPENAI_API_KEY") });
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

  it("passes through a structured upstream error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: { message: "Rate limit exceeded" } },
      { status: 429 },
    )));

    const response = await analyzePost(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post }),
    }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Rate limit exceeded" });
  });

  it("normalizes a successful OpenAI analysis response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      output_text: JSON.stringify({
        firstImpression: "明るい印象",
        imageMessage: "商品が分かりやすい",
        captionClarity: "明確",
        strengths: "冒頭が良い",
        weaknesses: "CTAが弱い",
        reason: "保存を促していないため",
        improvements: ["CTAを追加"],
        nextIdeas: ["比較投稿"],
        hashtags: ["#test"],
        score: 80,
      }),
    })));

    const response = await analyzePost(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ analysis: { score: 80 }, model: "gpt-4.1-mini" });
  });

  it("returns 502 when a growth analysis is not valid JSON", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ output_text: "not-json" })));

    const response = await analyzeGrowth(new Request("http://localhost/api/instagram/growth-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posts: [{ post, growth: 20, views: 120, reach: 100, snapshotCount: 2 }],
        period: "week",
      }),
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "AI分析結果の形式が不正でした。もう一度分析してください。" });
  });
});
