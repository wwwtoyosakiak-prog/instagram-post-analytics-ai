import { beforeEach, describe, expect, it } from "vitest";
import { filterPostsForSelectedAccount, getSelectedAccountId, setSelectedAccountId, uniqueAccountOptions, withSelectedAccount } from "@/lib/account-preference";
import type { InstagramPost } from "@/lib/types";

beforeEach(() => window.localStorage.clear());

describe("account preference", () => {
  it("同じInstagramユーザー名の表示名違いを1件にまとめる", () => {
    const base = { username: "tamaenergycircle", instagramApiUsername: "", profileUrl: "", industry: "", targetAudience: "", goal: "", openaiApiKeyEnvName: "", openaiModel: "", analysisInstructions: "", memo: "", createdAt: "", updatedAt: "" };
    const accounts = [
      { ...base, id: "username-only", name: "tamaenergycircle" },
      { ...base, id: "profile", name: "ペパポン班（多摩大学新西ゼミ）", instagramApiUsername: "tamaenergycircle" },
    ];

    expect(uniqueAccountOptions(accounts).map((account) => account.id)).toEqual(["profile"]);
  });

  it("選択中の重複項目は表示を維持する", () => {
    const base = { username: "tamaenergycircle", instagramApiUsername: "", profileUrl: "", industry: "", targetAudience: "", goal: "", openaiApiKeyEnvName: "", openaiModel: "", analysisInstructions: "", memo: "", createdAt: "", updatedAt: "" };
    const accounts = [
      { ...base, id: "selected", name: "tamaenergycircle" },
      { ...base, id: "profile", name: "ペパポン班（多摩大学新西ゼミ）" },
    ];

    expect(uniqueAccountOptions(accounts, "selected").map((account) => account.id)).toEqual(["selected"]);
  });

  it("ユーザー名が未保存の旧項目と正式表示名を1件にまとめる", () => {
    const base = { username: "", instagramApiUsername: "", profileUrl: "", industry: "", targetAudience: "", goal: "", openaiApiKeyEnvName: "", openaiModel: "", analysisInstructions: "", memo: "", createdAt: "", updatedAt: "" };
    const accounts = [
      { ...base, id: "legacy", name: "tamaenergycircle" },
      { ...base, id: "profile", name: "ペパポン班（多摩大学新西ゼミ）" },
    ];

    expect(uniqueAccountOptions(accounts).map((account) => account.id)).toEqual(["profile"]);
  });
  it("uses all accounts by default", () => {
    expect(getSelectedAccountId()).toBe("all");
    expect(withSelectedAccount("/api/instagram/dashboard")).toBe("/api/instagram/dashboard");
  });

  it("adds the selected account to Instagram API requests and filters posts", () => {
    setSelectedAccountId("account-2");
    const posts = [{ id: "p1", accountId: "account-1" }, { id: "p2", accountId: "account-2" }] as InstagramPost[];
    expect(withSelectedAccount("/api/instagram/media?limit=10")).toContain("account_id=account-2");
    expect(filterPostsForSelectedAccount(posts).map((post) => post.id)).toEqual(["p2"]);
  });
});
