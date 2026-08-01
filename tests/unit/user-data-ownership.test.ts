import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/authenticated-user";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("user data ownership", () => {
  it("reads only the identity supplied by trusted middleware", () => {
    expect(getAuthenticatedUser(new NextRequest("http://localhost"))).toBe("owner");
    expect(getAuthenticatedUser(new NextRequest("http://localhost", {
      headers: { "x-app-authenticated-user": "teammate" },
    }))).toBe("teammate");
  });

  it("adds the authenticated owner to Supabase reads when enabled", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("USER_DATA_OWNERSHIP_ENABLED", "true");
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { listAccountsFromSupabase } = await import("@/lib/supabase-admin");
    await listAccountsFromSupabase("teammate");

    expect(String(fetchMock.mock.calls[0][0])).toContain("owner_id=eq.teammate");
  });

  it("keeps legacy storage queries unchanged until ownership is enabled", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("USER_DATA_OWNERSHIP_ENABLED", "false");
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { listAccountsFromSupabase } = await import("@/lib/supabase-admin");
    await listAccountsFromSupabase("teammate");

    expect(String(fetchMock.mock.calls[0][0])).not.toContain("owner_id");
  });
});
