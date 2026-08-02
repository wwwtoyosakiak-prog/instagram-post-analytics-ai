import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/instagram/oauth/start/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Instagram OAuth start", () => {
  it("forces reauthentication so the user can choose the intended account", async () => {
    vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_ID", "instagram-app-id");
    vi.stubEnv("INSTAGRAM_OAUTH_CLIENT_SECRET", "instagram-app-secret");
    vi.stubEnv("INSTAGRAM_OAUTH_REDIRECT_URI", "https://example.com/api/instagram/oauth/callback");
    vi.stubEnv("APP_SESSION_SECRET", "a-long-session-secret-for-oauth-state");

    const response = await GET(new NextRequest("https://example.com/api/instagram/oauth/start", {
      headers: { "x-app-authenticated-user": "owner", "x-app-authenticated-role": "admin" },
    }));

    const location = response.headers.get("location");
    expect(response.status).toBe(307);
    expect(location).toBeTruthy();
    const authorizationUrl = new URL(location!);
    expect(authorizationUrl.origin).toBe("https://www.instagram.com");
    expect(authorizationUrl.searchParams.get("force_reauth")).toBe("true");
    expect(authorizationUrl.searchParams.get("client_id")).toBe("instagram-app-id");
  });
});
