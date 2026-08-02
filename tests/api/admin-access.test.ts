import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/users/route";

describe("admin user management", () => {
  it("rejects a non-admin before reading user data", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/users", { headers: { "x-app-authenticated-user": "teammate", "x-app-authenticated-role": "member" } }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "管理者だけが操作できます。" });
  });
});
