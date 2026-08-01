import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const originalUser = process.env.APP_ACCESS_USER;
const originalPassword = process.env.APP_ACCESS_PASSWORD;

function request(path = "/", authorization?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: authorization ? { authorization } : undefined,
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
    expect(middleware(request("/dashboard", `Basic ${credentials}`)).headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps health checks public and delegates cron bearer validation", () => {
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "strong-password";

    expect(middleware(request("/api/health")).headers.get("x-middleware-next")).toBe("1");
    expect(middleware(request("/api/instagram/sync", "Bearer cron-secret")).headers.get("x-middleware-next")).toBe("1");
  });
});
