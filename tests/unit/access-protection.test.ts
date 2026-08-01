import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const originalUser = process.env.APP_ACCESS_USER;
const originalPassword = process.env.APP_ACCESS_PASSWORD;

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
});

describe("access protection", () => {
  it("keeps the current behavior when access protection is not configured", () => {
    delete process.env.APP_ACCESS_USER;
    delete process.env.APP_ACCESS_PASSWORD;

    expect(middleware(request()).headers.get("x-middleware-next")).toBe("1");
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
