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
  const groups: { account: InstagramAccount; aliases: Set<string> }[] = [];
  const normalize = (value: string | undefined) => String(value ?? "")
    .replace(/^@/, "")
    .trim()
    .toLocaleLowerCase("ja-JP");

  for (const account of accounts) {
    const aliases = new Set(
      [account.name, account.username, account.instagramApiUsername]
        .map(normalize)
        .filter(Boolean),
    );
    const group = groups.find((item) => [...aliases].some((alias) => item.aliases.has(alias)));

    if (!group) {
      groups.push({ account, aliases });
      continue;
    }

    for (const alias of aliases) group.aliases.add(alias);
    const currentLooksLikeUsername = normalize(group.account.name) === normalize(group.account.username);
    const nextLooksLikeDisplayName = normalize(account.name) !== normalize(account.username);
    if (account.id === selectedAccountId || (group.account.id !== selectedAccountId && currentLooksLikeUsername && nextLooksLikeDisplayName)) {
      group.account = account;
    }
  }

  return groups.map((group) => group.account);
}
