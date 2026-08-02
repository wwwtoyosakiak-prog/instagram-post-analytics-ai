import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sync failure notification", () => {
  it("does nothing when a webhook is not configured", async () => {
    const { notifySyncFailure } = await import("@/lib/sync-failure-notification");
    await expect(notifySyncFailure("owner", "failure")).resolves.toMatchObject({ sent: false, reason: "not_configured" });
  });

  it("sends a safe failure message to the configured webhook", async () => {
    vi.stubEnv("SYNC_FAILURE_WEBHOOK_URL", "https://hooks.example.test/sync");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { notifySyncFailure } = await import("@/lib/sync-failure-notification");

    await expect(notifySyncFailure("owner", "temporary failure")).resolves.toMatchObject({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith("https://hooks.example.test/sync", expect.objectContaining({ method: "POST" }));
  });
});
