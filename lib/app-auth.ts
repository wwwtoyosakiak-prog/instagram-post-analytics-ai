export const SESSION_COOKIE = "instagram_ai_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

export type AppRole = "admin" | "member";
type AppUser = { username: string; password: string; ownerId: string; role: AppRole };

export function readAppUsers(): AppUser[] | null {
  const configuredUsers = process.env.APP_ACCESS_USERS;
  if (configuredUsers) {
    if (
      process.env.USER_DATA_OWNERSHIP_ENABLED !== "true"
      || !process.env.SUPABASE_URL
      || !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) return null;
    try {
      const parsed = JSON.parse(configuredUsers) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
      const users = Object.entries(parsed)
        .filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1]))
        .map(([username, password]) => ({ username, password, ownerId: username, role: username === "owner" ? "admin" : "member" as AppRole }));
      return users.length ? users : null;
    } catch {
      return null;
    }
  }
  const username = process.env.APP_ACCESS_USER;
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!username && !password) return [];
  if (!username || !password) return null;
  return [{ username, password, ownerId: "owner", role: "admin" }];
}

function constantTimeEqual(actual: string, expected: string) {
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function authenticateAppUser(username: string, password: string) {
  const users = readAppUsers();
  if (!users) return { status: "invalid_configuration" as const };
  const user = users.find((candidate) =>
    constantTimeEqual(candidate.username, username) && constantTimeEqual(candidate.password, password));
  return user ? { status: "authenticated" as const, ownerId: user.ownerId, role: user.role } : { status: "invalid_credentials" as const };
}

function toBase64Url(value: Uint8Array | string) {
  const binary = typeof value === "string" ? value : String.fromCharCode(...value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function createSession(ownerId: string, role: AppRole = ownerId === "owner" ? "admin" : "member") {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error("APP_SESSION_SECRET is not configured.");
  const payload = toBase64Url(JSON.stringify({ ownerId, role, expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function readSession(value?: string | null) {
  return (await readSessionDetails(value))?.ownerId ?? null;
}

export async function readSessionDetails(value?: string | null) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || !value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !constantTimeEqual(signature, await sign(payload, secret))) return null;
  try {
    const decoded = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as { ownerId?: string; role?: AppRole; expiresAt?: number };
    if (!decoded.ownerId || !decoded.expiresAt || decoded.expiresAt <= Date.now() / 1000) return null;
    return { ownerId: decoded.ownerId, role: decoded.role === "admin" ? "admin" as const : "member" as const };
  } catch {
    return null;
  }
}

export const sessionMaxAge = SESSION_SECONDS;
