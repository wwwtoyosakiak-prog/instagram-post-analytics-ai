import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson, requestJsonOr } from "@/lib/client-api";

describe("client API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正常なJSONを返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));

    await expect(requestJson<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });
  });

  it("APIのエラーメッセージと状態コードを保持する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "設定を確認してください。" }), { status: 400 }),
    ));

    await expect(requestJson("/api/test")).rejects.toMatchObject({
      message: "設定を確認してください。",
      status: 400,
    });
  });

  it("画面固有の代替メッセージを使用する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 503 }),
    ));

    await expect(requestJson("/api/test", {}, "プロフィールを取得できませんでした。")).rejects.toMatchObject({
      message: "プロフィールを取得できませんでした。",
      status: 503,
    });
  });

  it("JSONでない応答を共通エラーにする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status: 502 })));

    await expect(requestJson("/api/test")).rejects.toMatchObject({
      message: "サーバーから正しい応答を受け取れませんでした。",
      status: 502,
    });
  });

  it("任意取得では失敗時に既定値を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(requestJsonOr("/api/test", { data: [] })).resolves.toEqual({ data: [] });
  });
});
