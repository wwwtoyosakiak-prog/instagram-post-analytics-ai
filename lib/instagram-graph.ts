export type InstagramGraphMode = "facebook_login" | "instagram_login";

export type InstagramGraphConfig = {
  accessToken: string;
  version: string;
  mode: InstagramGraphMode;
  baseUrl: string;
  accountResource: string;
};

export function getInstagramGraphConfig(): InstagramGraphConfig {
  const accessToken = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v23.0";
  const mode = process.env.INSTAGRAM_GRAPH_API_MODE === "instagram_login"
    ? "instagram_login"
    : "facebook_login";
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accessToken) {
    throw new Error("INSTAGRAM_GRAPH_ACCESS_TOKEN が設定されていません。");
  }
  if (mode === "facebook_login" && !accountId) {
    throw new Error("従来方式では INSTAGRAM_BUSINESS_ACCOUNT_ID が必要です。");
  }

  return {
    accessToken,
    version,
    mode,
    baseUrl: mode === "instagram_login" ? "https://graph.instagram.com" : "https://graph.facebook.com",
    accountResource: mode === "instagram_login" ? "me" : accountId!
  };
}

export function createInstagramGraphUrl(config: InstagramGraphConfig, path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(`${config.baseUrl}/${config.version}/${normalizedPath}`);
}
