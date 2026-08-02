type InstagramGraphMode = "instagram_login" | "facebook_login";

export type InstagramUserConfig = {
  accessToken: string;
  businessAccountId?: string;
  mode: InstagramGraphMode;
};

function readConfigs() {
  const raw = process.env.INSTAGRAM_USER_CONFIGS;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, { accessToken?: unknown; businessAccountId?: unknown; mode?: unknown }>;
  } catch {
    return {};
  }
}

export function getInstagramUserConfig(ownerId: string): InstagramUserConfig | null {
  const value = readConfigs()[ownerId];
  if (!value || typeof value.accessToken !== "string" || !value.accessToken) return null;
  const mode = value.mode === "facebook_login" ? "facebook_login" : "instagram_login";
  const businessAccountId = typeof value.businessAccountId === "string" ? value.businessAccountId : undefined;
  if (mode === "facebook_login" && !businessAccountId) return null;
  return { accessToken: value.accessToken, businessAccountId, mode };
}

export function hasInstagramConnection(ownerId: string) {
  return ownerId === "owner" || getInstagramUserConfig(ownerId) !== null;
}
