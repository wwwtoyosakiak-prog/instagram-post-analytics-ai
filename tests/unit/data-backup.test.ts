import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "@/lib/data-backup";
import type { InstagramAccount, InstagramPost } from "@/lib/types";

const account = { id: "a1", name: "Account", username: "account" } as InstagramAccount;
const post = { id: "p1", date: "2026-08-01", caption: "caption" } as InstagramPost;

describe("data backup", () => {
  it("creates and reads a supported backup", () => {
    const backup = createBackup([account], [post]);
    expect(parseBackup(JSON.stringify(backup))).toMatchObject({ version: 1, accounts: [account], posts: [post] });
  });

  it("rejects malformed backup data", () => {
    expect(() => parseBackup('{"version":1,"accounts":[],"posts":[{}]}')).toThrow("Invalid backup file");
  });
});
