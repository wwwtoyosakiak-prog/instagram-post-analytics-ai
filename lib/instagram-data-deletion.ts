import { randomBytes } from "node:crypto";
import { getStoredInstagramConnectionByInstagramUserId } from "@/lib/instagram-connection-store";
import { supabaseRestRequest } from "@/lib/supabase-server";

export type DataDeletionRequest = {
  confirmation_code: string;
  status: "processing" | "completed" | "failed";
  requested_at: string;
  completed_at: string | null;
};

const ownerDataTables = [
  "instagram_post_insight_snapshots",
  "instagram_post_analyses",
  "instagram_monthly_reports",
  "instagram_sync_runs",
  "instagram_posts",
  "instagram_accounts",
  "app_data_backups",
  "instagram_user_connections",
] as const;

async function updateRequest(confirmationCode: string, values: Record<string, unknown>) {
  await supabaseRestRequest(`instagram_data_deletion_requests?confirmation_code=eq.${encodeURIComponent(confirmationCode)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(values),
  });
}

export async function processInstagramDataDeletion(instagramUserId: string) {
  const confirmationCode = randomBytes(16).toString("hex");
  const connection = await getStoredInstagramConnectionByInstagramUserId(instagramUserId);
  await supabaseRestRequest("instagram_data_deletion_requests", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ confirmation_code: confirmationCode, instagram_user_id: instagramUserId, status: "processing" }),
  });

  try {
    if (connection) {
      for (const table of ownerDataTables) {
        await supabaseRestRequest(`${table}?owner_id=eq.${encodeURIComponent(connection.owner_id)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        });
      }
    }
    await updateRequest(confirmationCode, { status: "completed", instagram_user_id: null, completed_at: new Date().toISOString() });
  } catch (error) {
    await updateRequest(confirmationCode, { status: "failed" }).catch(() => undefined);
    throw error;
  }

  return confirmationCode;
}

export async function readDataDeletionStatus(confirmationCode: string) {
  const rows = await supabaseRestRequest<DataDeletionRequest[]>(
    `instagram_data_deletion_requests?confirmation_code=eq.${encodeURIComponent(confirmationCode)}&select=confirmation_code,status,requested_at,completed_at&limit=1`,
  ).catch(() => []);
  return rows[0] ?? null;
}
