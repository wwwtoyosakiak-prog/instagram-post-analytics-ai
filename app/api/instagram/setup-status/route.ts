import { NextResponse } from "next/server";
import { fetchAccountInfo } from "@/lib/instagram-graph-api";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { getStoredInstagramConnection } from "@/lib/instagram-connection-store";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getInstagramUserConfig } from "@/lib/instagram-user-config";

async function readSetupStatus(request: Request) {
  const ownerId = getAuthenticatedUser(request);
  const db = getSupabaseServerClient();
  const connection = await getStoredInstagramConnection(ownerId);
  let deletionTableReady = false;
  let duplicateProtectionReady = false;
  if (db) {
    const deletionProbe = await db.from("instagram_data_deletion_requests").select("id").limit(1);
    deletionTableReady = !deletionProbe.error;
    const accountProbe = await db.from("instagram_accounts").select("identity_key").limit(1);
    duplicateProtectionReady = !accountProbe.error;
  }
  return {
    oauthConfigured: Boolean(process.env.INSTAGRAM_OAUTH_CLIENT_ID && process.env.INSTAGRAM_OAUTH_CLIENT_SECRET && process.env.INSTAGRAM_OAUTH_REDIRECT_URI),
    connectionReady: Boolean(connection || getInstagramUserConfig(ownerId)),
    databaseReady: Boolean(db),
    deletionTableReady,
    duplicateProtectionReady,
  };
}

export async function GET(request: Request) {
  return NextResponse.json(await readSetupStatus(request));
}

export async function POST(request: Request) {
  const ownerId = getAuthenticatedUser(request);
  try {
    const account = await fetchAccountInfo(undefined, ownerId);
    return NextResponse.json({ ok: true, username: account.username ?? null, message: `@${account.username ?? "Instagram"} への接続を確認しました。` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Instagram接続を確認できませんでした。" }, { status: 502 });
  }
}
