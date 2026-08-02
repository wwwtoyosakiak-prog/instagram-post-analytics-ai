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
    oauthConfigured: Boolean(process.env.INSTAGRAM_OAUTH_CLIENT_ID && process.env.INSTAGRAM_OAUTH_CLIENT_SECRET && process.env.INSTAGRAM_OAUTH_REDIRECT_URI && process.env.APP_SESSION_SECRET),
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
    const apiError = error && typeof error === "object" ? error as { type?: unknown; message?: unknown } : null;
    const message = apiError?.type === "token_expired"
      ? "Instagramの認証期限が切れています。連携を解除して、もう一度接続してください。"
      : apiError?.type === "permission_denied"
        ? "Instagramの必要な権限が許可されていません。連携を解除して、権限を許可し直してください。"
        : "Instagramへ接続できませんでした。連携を解除して、接続したいアカウントでやり直してください。";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
