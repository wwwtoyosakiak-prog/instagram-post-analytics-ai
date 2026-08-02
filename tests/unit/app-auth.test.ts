import { afterEach, describe, expect, it } from "vitest";
import { authenticateAppUser, createSession, readSession } from "@/lib/app-auth";

const originalUser = process.env.APP_ACCESS_USER;
const originalPassword = process.env.APP_ACCESS_PASSWORD;
const originalUsers = process.env.APP_ACCESS_USERS;
const originalSecret = process.env.APP_SESSION_SECRET;

afterEach(() => {
  if (originalUser === undefined) delete process.env.APP_ACCESS_USER;
  else process.env.APP_ACCESS_USER = originalUser;
  if (originalPassword === undefined) delete process.env.APP_ACCESS_PASSWORD;
  else process.env.APP_ACCESS_PASSWORD = originalPassword;
  if (originalUsers === undefined) delete process.env.APP_ACCESS_USERS;
  else process.env.APP_ACCESS_USERS = originalUsers;
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("app session authentication", () => {
  it("authenticates the legacy owner credentials", () => {
    delete process.env.APP_ACCESS_USERS;
    process.env.APP_ACCESS_USER = "owner";
    process.env.APP_ACCESS_PASSWORD = "secret-password";
    expect(authenticateAppUser("owner", "secret-password")).toEqual({ status: "authenticated", ownerId: "owner" });
    expect(authenticateAppUser("owner", "wrong").status).toBe("invalid_credentials");
  });

  it("creates a signed session and rejects tampering", async () => {
    process.env.APP_SESSION_SECRET = "test-session-secret-that-is-long-enough";
    const session = await createSession("teammate");
    expect(await readSession(session)).toBe("teammate");
    expect(await readSession(`${session.slice(0, -1)}x`)).toBeNull();
  });
});
