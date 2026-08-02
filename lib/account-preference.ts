import type { InstagramAccount, InstagramPost } from "@/lib/types";

const STORAGE_KEY = "instagram-ai-selected-account-v1";

export function getSelectedAccountId() {
  if (typeof window === "undefined") return "all";
  return window.localStorage.getItem(STORAGE_KEY) || "all";
}

export function setSelectedAccountId(accountId: string) {
  window.localStorage.setItem(STORAGE_KEY, accountId || "all");
}

export function filterPostsForSelectedAccount(posts: InstagramPost[]) {
  const accountId = getSelectedAccountId();
  return accountId === "all" ? posts : posts.filter((post) => post.accountId === accountId);
}

export function withSelectedAccount(url: string) {
  const accountId = getSelectedAccountId();
  if (accountId === "all") return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}account_id=${encodeURIComponent(accountId)}`;
}

export function uniqueAccountOptions(accounts: InstagramAccount[], selectedAccountId = "all") {
  const byName = new Map<string, InstagramAccount>();
  for (const account of accounts) {
    const key = account.name.trim().toLocaleLowerCase("ja-JP");
    const current = byName.get(key);
    if (!current || account.id === selectedAccountId) byName.set(key, account);
  }
  return [...byName.values()];
}
