import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const originalUser = process.env.APP_ACCESS_USER;
const originalPassword = process.env.APP_ACCESS_PASSWORD;
const originalUsers = process.env.APP_ACCESS_USERS;
const originalOwnershipEnabled = process.env.USER_DATA_OWNERSHIP_ENABLED;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalSessionSecret = process.env.APP_SESSION_SECRET;
const originalInstagramUserConfigs = process.env.INSTAGRAM_USER_CONFIGS;

function request(path = "/", authorization?: string, authenticatedUser?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(authenticatedUser ? { "x-app-authenticated-user": authenticatedUser } : {}),
    },
  });
}

afterEach(() => {
  if (originalUser === undefined) delete process.env.APP_ACCESS_USER;
  else process.env.APP_ACCESS_USER = originalUser;
  if (originalPassword === undefined) delete process.env.APP_ACCESS_PASSWORD;
  else process.env.APP_ACCESS_PASSWORD = originalPassword;
  if (originalUsers === undefined) delete process.env.APP_ACCESS_USERS;
  else process.env.APP_ACCESS_USERS = originalUsers;
  if (originalOwnershipEnabled === undefined) delete process.env.USER_DATA_OWNERSHIP_ENABLED;
  else process.env.USER_DATA_OWNERSHIP_ENABLED = originalOwnershipEnabled;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseKey;
  if (originalSessionSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSessionSecret;
  if (originalInstagramUserConfigs === undefined) delete process.env.INSTAGRAM_USER_CONFIGS;
  else process.env.INSTAGRAM_USER_CONFIGS = originalInstagramUserConfigs;
});

describe("access protection", () => {
  it("keeps the current behavior when access protection is not configured", async () => {
    delete process.env.APP_ACCESS_USER;
    delete process.env.APP_ACCESS_PASSWORD;
    delete process.env.APP_ACCESS_USERS;

    expect((await middleware(request())).headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts multiple configured users and forwards the matched identity", async () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const owner = await middleware(request("/", `Basic ${btoa("owner:owner-password")}`));
    const teammate = await middleware(request("/", `Basic ${btoa("teammate:team-password")}`));

    expect(owner.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");
    expect(owner.headers.get("x-middleware-request-x-app-authenticated-role")).toBe("admin");
    expect(teammate.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("teammate");
    expect(teammate.headers.get("x-middleware-request-x-app-authenticated-role")).toBe("member");
    expect((await middleware(request("/", `Basic ${btoa("teammate:owner-password")}`))).status).toBe(401);
  });

  it("allows scoped Instagram screens without exposing the primary credential", async () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const teammateCredentials = `Basic ${btoa("teammate:team-password")}`;
    expect((await middleware(request("/api/data/posts", teammateCredentials))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(request("/api/instagram/dashboard", teammateCredentials))).headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed when the multi-user setting is invalid", async () => {
    process.env.APP_ACCESS_USERS = "not-json";
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    expect((await middleware(request())).status).toBe(503);
  });

  it("does not enable multiple users before data ownership is enabled", async () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    delete process.env.USER_DATA_OWNERSHIP_ENABLED;
    expect((await middleware(request())).status).toBe(503);
  });

  it("fails closed when only one credential is configured", async () => {
    process.env.APP_ACCESS_USER = "owner";
    delete process.env.APP_ACCESS_PASSWORD;

    expect((await middleware(request())).status).toBe(503);
  });

  it("requires and accepts valid Basic authentication", async () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    const unauthorized = await middleware(request());
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Basic");

    const credentials = btoa("owner:strong-password");
    const authorized = await middleware(request("/dashboard", `Basic ${credentials}`));
    expect(authorized.headers.get("x-middleware-next")).toBe("1");
    expect(authorized.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");
  });

  it("does not trust a user identity supplied by the browser", async () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    const credentials = btoa("owner:strong-password");
    const authorized = await middleware(request("/dashboard", `Basic ${credentials}`, "attacker"));
    expect(authorized.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");

    const publicRequest = await middleware(request("/api/health", undefined, "attacker"));
    expect(publicRequest.headers.get("x-middleware-request-x-app-authenticated-user")).toBeNull();
  });

  it("rejects credentials when either value is different", async () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    expect((await middleware(request("/", `Basic ${btoa("other:strong-password")}`))).status).toBe(401);
    expect((await middleware(request("/", `Basic ${btoa("owner:wrong-password")}`))).status).toBe(401);
  });

  it("keeps health checks public and delegates cron bearer validation", async () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    expect((await middleware(request("/api/health"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(request("/api/instagram/sync", "Bearer cron-secret"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(request("/api/instagram/deauthorize"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(request("/api/instagram/data-deletion"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(request("/data-deletion/status?code=test"))).headers.get("x-middleware-next")).toBe("1");
  });

  it("uses the dedicated login page when session login is enabled", async () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";
    process.env.APP_SESSION_SECRET = "a-long-session-signing-secret";

    const pageResponse = await middleware(request("/dashboard"));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toContain("/login?next=%2Fdashboard");
    expect((await middleware(request("/api/data/posts"))).status).toBe(401);
    expect((await middleware(request("/login"))).headers.get("x-middleware-next")).toBe("1");
  });

  it("allows an additional user's configured Instagram connection", async () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.INSTAGRAM_USER_CONFIGS = JSON.stringify({ teammate: { accessToken: "token" } });

    const response = await middleware(request("/api/instagram/dashboard", `Basic ${btoa("teammate:team-password")}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
