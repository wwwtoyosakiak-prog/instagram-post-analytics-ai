import { describe, expect, it, vi } from "vitest";
import { logClientIssue, logServerIssue, redactSensitiveLogText, safeErrorMessage } from "@/lib/safe-logging";

describe("safe logging", () => {
  it("URL、トークン、長い識別子を伏字にする", () => {
    const input = "https://graph.instagram.com/12345678901234567890123456789012?access_token=secret-token Bearer abcdefghijklmnopqrstuvwxyz123456";
    const result = redactSensitiveLogText(input);

    expect(result).not.toContain("graph.instagram.com");
    expect(result).not.toContain("secret-token");
    expect(result).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(result).toContain("[REDACTED_URL]");
  });

  it("生のオブジェクトをログへ渡さない", () => {
    const error = { message: "request failed for https://example.com/private?token=secret", raw: { token: "secret" } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerIssue("instagram-test", error, { stage: "sync" });

    expect(spy).toHaveBeenCalledWith("[instagram-test]", {
      message: "request failed for [REDACTED_URL]",
      stage: "sync",
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('"raw"');
    spy.mockRestore();
  });

  it("不明な値には安全な既定メッセージを使う", () => {
    expect(safeErrorMessage({ token: "secret" })).toBe("処理に失敗しました。");
  });

  it("クライアントログでも機密情報を伏字にする", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logClientIssue("profile-load", new Error("failed https://example.com/private?token=secret"));

    expect(spy).toHaveBeenCalledWith("[profile-load] failed [REDACTED_URL]");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    spy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("本番環境ではクライアント警告を出さない", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logClientIssue("profile-load", new Error("offline"));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    vi.unstubAllEnvs();
  });
});
