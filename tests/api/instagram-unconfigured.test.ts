import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDashboard } from "@/app/api/instagram/dashboard/route";
import { POST as runFullSync } from "@/app/api/instagram/full-sync/route";
import { GET as getMedia } from "@/app/api/instagram/media/route";

function removeSupabaseConfiguration() {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Instagram API without Supabase configuration", () => {
  it("returns an empty media list without throwing", async () => {
    removeSupabaseConfiguration();

    const response = await getMedia(new NextRequest("http://localhost/api/instagram/media"));
    await expect(response.json()).resolves.toMatchObject({ configured: false, data: [] });
    expect(response.status).toBe(200);
  });

  it("returns an empty dashboard with a clear connection state", async () => {
    removeSupabaseConfiguration();

    const response = await getDashboard(new NextRequest("http://localhost/api/instagram/dashboard"));
    await expect(response.json()).resolves.toMatchObject({
      configured: false,
      account: null,
      totals: { posts: 0 },
    });
    expect(response.status).toBe(200);
  });

  it("returns a structured error when manual sync cannot start", async () => {
    removeSupabaseConfiguration();

    const response = await runFullSync(new Request("http://localhost/api/instagram/full-sync", { method: "POST" }));
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      status: "failed",
      error: "Instagramデータベースが未接続です。",
    });
    expect(response.status).toBe(503);
  });
});
