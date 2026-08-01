import { beforeEach, describe, expect, it } from "vitest";
import { filterPostsForSelectedAccount, getSelectedAccountId, setSelectedAccountId, withSelectedAccount } from "@/lib/account-preference";
import type { InstagramPost } from "@/lib/types";

beforeEach(() => window.localStorage.clear());

describe("account preference", () => {
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
