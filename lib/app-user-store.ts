import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseRestRequest } from "@/lib/supabase-server";
import type { AppRole } from "@/lib/app-auth";

export type StoredAppUser = {
  id: string;
  username: string;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type StoredAppUserWithPassword = StoredAppUser & { password_hash: string };

function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex")}`;
}

function passwordMatches(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = pbkdf2Sync(password, salt, 210_000, 32, "sha256");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticateStoredUser(username: string, password: string) {
  const rows = await supabaseRestRequest<StoredAppUserWithPassword[]>(
    `app_users?username=eq.${encodeURIComponent(username)}&active=eq.true&select=*&limit=1`,
  ).catch(() => []);
  const user = rows[0];
  if (!user || !passwordMatches(password, user.password_hash)) return null;
  return { ownerId: user.username, role: user.role };
}

export async function listStoredUsers() {
  return supabaseRestRequest<StoredAppUser[]>("app_users?select=id,username,role,active,created_at,updated_at&order=created_at.asc");
}

export async function createStoredUser(username: string, password: string, role: AppRole) {
  const rows = await supabaseRestRequest<StoredAppUser[]>("app_users?select=id,username,role,active,created_at,updated_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ username, password_hash: passwordHash(password), role, active: true }),
  });
  return rows[0];
}

export async function updateStoredUser(id: string, values: { password?: string; role?: AppRole; active?: boolean }) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (values.password) payload.password_hash = passwordHash(values.password);
  if (values.role) payload.role = values.role;
  if (typeof values.active === "boolean") payload.active = values.active;
  const rows = await supabaseRestRequest<StoredAppUser[]>(`app_users?id=eq.${encodeURIComponent(id)}&select=id,username,role,active,created_at,updated_at`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return rows[0];
}
