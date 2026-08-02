import { supabaseRestRequest } from "@/lib/supabase-server";

export type InstagramConnection = { owner_id: string; access_token: string; instagram_user_id: string | null; username: string | null; expires_at: string | null; updated_at: string };

export async function getStoredInstagramConnection(ownerId: string) {
  const rows = await supabaseRestRequest<InstagramConnection[]>(`instagram_user_connections?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`).catch(() => []);
  return rows[0] ?? null;
}

export async function saveStoredInstagramConnection(ownerId: string, values: Omit<InstagramConnection, "owner_id" | "updated_at">) {
  await supabaseRestRequest("instagram_user_connections?on_conflict=owner_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ owner_id: ownerId, ...values, updated_at: new Date().toISOString() }),
  });
}

export async function deleteStoredInstagramConnection(ownerId: string) {
  await supabaseRestRequest(`instagram_user_connections?owner_id=eq.${encodeURIComponent(ownerId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function getStoredInstagramConnectionByInstagramUserId(instagramUserId: string) {
  const rows = await supabaseRestRequest<InstagramConnection[]>(`instagram_user_connections?instagram_user_id=eq.${encodeURIComponent(instagramUserId)}&select=*&limit=1`).catch(() => []);
  return rows[0] ?? null;
}
