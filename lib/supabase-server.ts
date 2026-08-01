import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseConfiguration = { url: string; serviceRoleKey: string };

function readSupabaseConfiguration(): SupabaseConfiguration | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function getMissingSupabaseEnvNames() {
  return [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((value): value is string => Boolean(value));
}

export function isSupabaseServerConfigured() {
  return readSupabaseConfiguration() !== null;
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const configuration = readSupabaseConfiguration();
  return configuration ? createClient(configuration.url, configuration.serviceRoleKey) : null;
}

export function requireSupabaseServerClient(): SupabaseClient {
  const client = getSupabaseServerClient();
  if (!client) throw new Error("Supabase環境変数が設定されていません。");
  return client;
}

export async function supabaseRestRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const configuration = readSupabaseConfiguration();
  if (!configuration) throw new Error("Supabase環境変数が設定されていません。");

  const response = await fetch(`${configuration.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: configuration.serviceRoleKey,
      Authorization: `Bearer ${configuration.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
