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
  const looksLikeInstagramUsername = (value: string) => /^[a-z0-9._]{1,30}$/i.test(value);

  // 古い手動登録には username が保存されていないことがある。
  // 2件だけで「ユーザー名形式」と「正式表示名」に分かれている場合は、
  // 同じ接続から生まれた表示違いとして1件にまとめる。
  const legacyUsernameAlias = accounts.length === 2
    ? accounts.map((account) => normalize(account.name)).find(looksLikeInstagramUsername) ?? ""
    : "";
  const hasOneUsernameStyleName = legacyUsernameAlias
    && accounts.filter((account) => looksLikeInstagramUsername(normalize(account.name))).length === 1;

  for (const account of accounts) {
    const aliases = new Set(
      [account.name, account.username, account.instagramApiUsername]
        .map(normalize)
        .filter(Boolean),
    );
    if (hasOneUsernameStyleName) aliases.add(legacyUsernameAlias);
    const group = groups.find((item) => [...aliases].some((alias) => item.aliases.has(alias)));

    if (!group) {
      groups.push({ account, aliases });
      continue;
    }

    for (const alias of aliases) group.aliases.add(alias);
    const currentLooksLikeUsername = normalize(group.account.name) === normalize(group.account.username)
      || looksLikeInstagramUsername(normalize(group.account.name));
    const nextLooksLikeDisplayName = normalize(account.name) !== normalize(account.username)
      && !looksLikeInstagramUsername(normalize(account.name));
    if (account.id === selectedAccountId || (group.account.id !== selectedAccountId && currentLooksLikeUsername && nextLooksLikeDisplayName)) {
      group.account = account;
    }
  }

  return groups.map((group) => group.account);
}
