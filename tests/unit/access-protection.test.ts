import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const originalUser = process.env.APP_ACCESS_USER;
const originalPassword = process.env.APP_ACCESS_PASSWORD;
const originalUsers = process.env.APP_ACCESS_USERS;
const originalOwnershipEnabled = process.env.USER_DATA_OWNERSHIP_ENABLED;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
});

describe("access protection", () => {
  it("keeps the current behavior when access protection is not configured", () => {
    delete process.env.APP_ACCESS_USER;
    delete process.env.APP_ACCESS_PASSWORD;
    delete process.env.APP_ACCESS_USERS;

    expect(middleware(request()).headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts multiple configured users and forwards the matched identity", () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const owner = middleware(request("/", `Basic ${btoa("owner:owner-password")}`));
    const teammate = middleware(request("/", `Basic ${btoa("teammate:team-password")}`));

    expect(owner.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");
    expect(teammate.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("teammate");
    expect(middleware(request("/", `Basic ${btoa("teammate:owner-password")}`)).status).toBe(401);
  });

  it("keeps the primary Instagram connection private from additional users", () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const teammateCredentials = `Basic ${btoa("teammate:team-password")}`;
    expect(middleware(request("/api/data/posts", teammateCredentials)).headers.get("x-middleware-next")).toBe("1");
    expect(middleware(request("/api/instagram/dashboard", teammateCredentials)).status).toBe(403);
  });

  it("fails closed when the multi-user setting is invalid", () => {
    process.env.APP_ACCESS_USERS = "not-json";
    process.env.USER_DATA_OWNERSHIP_ENABLED = "true";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    expect(middleware(request()).status).toBe(503);
  });

  it("does not enable multiple users before data ownership is enabled", () => {
    process.env.APP_ACCESS_USERS = JSON.stringify({ owner: "owner-password", teammate: "team-password" });
    delete process.env.USER_DATA_OWNERSHIP_ENABLED;
    expect(middleware(request()).status).toBe(503);
  });

  it("fails closed when only one credential is configured", () => {
    process.env.APP_ACCESS_USER = "owner";
    delete process.env.APP_ACCESS_PASSWORD;

    expect(middleware(request()).status).toBe(503);
  });

  it("requires and accepts valid Basic authentication", () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    const unauthorized = middleware(request());
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toContain("Basic");

    const credentials = btoa("owner:strong-password");
    const authorized = middleware(request("/dashboard", `Basic ${credentials}`));
    expect(authorized.headers.get("x-middleware-next")).toBe("1");
    expect(authorized.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");
  });

  it("does not trust a user identity supplied by the browser", () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    const credentials = btoa("owner:strong-password");
    const authorized = middleware(request("/dashboard", `Basic ${credentials}`, "attacker"));
    expect(authorized.headers.get("x-middleware-request-x-app-authenticated-user")).toBe("owner");

    const publicRequest = middleware(request("/api/health", undefined, "attacker"));
    expect(publicRequest.headers.get("x-middleware-request-x-app-authenticated-user")).toBeNull();
  });

  it("rejects credentials when either value is different", () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    expect(middleware(request("/", `Basic ${btoa("other:strong-password")}`)).status).toBe(401);
    expect(middleware(request("/", `Basic ${btoa("owner:wrong-password")}`)).status).toBe(401);
  });

  it("keeps health checks public and delegates cron bearer validation", () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    expect(middleware(request("/api/health")).headers.get("x-middleware-next")).toBe("1");
    expect(middleware(request("/api/instagram/sync", "Bearer cron-secret")).headers.get("x-middleware-next")).toBe("1");
  });
});
