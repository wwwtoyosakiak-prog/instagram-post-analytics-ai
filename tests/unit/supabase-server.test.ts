import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMissingSupabaseEnvNames,
  isSupabaseServerConfigured,
  supabaseRestRequest,
} from "@/lib/supabase-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Supabase server connection", () => {
  it("reports missing environment variables consistently", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(isSupabaseServerConfigured()).toBe(false);
    expect(getMissingSupabaseEnvNames()).toEqual(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("uses the shared URL and authentication headers", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ id: "1" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(supabaseRestRequest<Array<{ id: string }>>("items?select=id")).resolves.toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/items?select=id",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          apikey: "service-role-key",
          Authorization: "Bearer service-role-key",
        }),
      }),
    );
  });

  it("rejects requests when configuration is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(supabaseRestRequest("items")).rejects.toThrow("Supabase環境変数が設定されていません。");
  });

  it("handles an empty 204 response", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(supabaseRestRequest("items", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("reports a failed database response", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("database unavailable", { status: 503 })));

    await expect(supabaseRestRequest("items")).rejects.toThrow("database unavailable");
  });
});
