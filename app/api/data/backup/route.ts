import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { supabaseRestRequest } from "@/lib/supabase-server";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { isAuthenticatedAdmin } from "@/lib/authenticated-user";

const tables = [
  "instagram_accounts",
  "instagram_posts",
  "instagram_media",
  "instagram_post_analyses",
  "instagram_post_insight_snapshots",
  "instagram_media_insights",
  "instagram_account_insights",
  "instagram_daily_snapshots",
  "instagram_monthly_reports",
  "instagram_sync_runs",
] as const;

type TableName = typeof tables[number];
type BackupPayload = { version: 2; exportedAt: string; data: Record<TableName, Array<Record<string, unknown>>> };

const ownerScopedTables = new Set<TableName>([
  "instagram_accounts",
  "instagram_posts",
  "instagram_post_analyses",
  "instagram_post_insight_snapshots",
  "instagram_monthly_reports",
  "instagram_sync_runs",
]);

function queryForOwner(ownerId: string) {
  return process.env.USER_DATA_OWNERSHIP_ENABLED === "true"
    ? `owner_id=eq.${encodeURIComponent(ownerId)}&select=*`
    : "select=*";
}

function queryForAccounts(accountIds: string[]) {
  if (process.env.USER_DATA_OWNERSHIP_ENABLED !== "true") return "select=*";
  if (!accountIds.length) return null;
  return `account_id=in.(${accountIds.map(encodeURIComponent).join(",")})&select=*`;
}

function rowsForOwner(table: TableName, rows: Array<Record<string, unknown>>, ownerId: string) {
  return rows.map((row) => {
    const restoredRow = { ...row };
    delete restoredRow.owner_id;
    return {
      ...restoredRow,
      ...(process.env.USER_DATA_OWNERSHIP_ENABLED === "true" && ownerScopedTables.has(table) ? { owner_id: ownerId } : {}),
    };
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "サーバー保存が未設定です。" }, { status: 501 });
  const ownerId = getAuthenticatedUser(request);
  const payload = await createBackupPayload(ownerId);
  if (request.nextUrl.searchParams.get("automatic") === "true") {
    await saveRecoverySnapshot(ownerId, payload, "daily");
    return NextResponse.json({ ok: true, savedAt: payload.exportedAt });
  }
  return NextResponse.json(payload);
}

async function createBackupPayload(ownerId: string): Promise<BackupPayload> {
  const accounts = await supabaseRestRequest<Array<Record<string, unknown>>>(`instagram_accounts?${queryForOwner(ownerId)}`);
  const accountIds = accounts.map((account) => String(account.id));
  const entries = await Promise.all(tables.map(async (table) => {
    if (table === "instagram_accounts") return [table, accounts] as const;
    const query = ownerScopedTables.has(table) ? queryForOwner(ownerId) : queryForAccounts(accountIds);
    return [table, query ? await supabaseRestRequest<Array<Record<string, unknown>>>(`${table}?${query}`) : []] as const;
  }));
  return { version: 2, exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) as BackupPayload["data"] };
}

function encryptBackup(payload: BackupPayload) {
  const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.APP_SESSION_SECRET;
  if (!secret) return JSON.stringify(payload);
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

async function saveRecoverySnapshot(ownerId: string, payload: BackupPayload, kind: "daily" | "pre_restore") {
  await supabaseRestRequest("app_data_backups?on_conflict=owner_id,backup_date,kind", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ owner_id: ownerId, backup_date: new Date().toISOString().slice(0, 10), kind, encrypted_payload: encryptBackup(payload), row_count: tables.reduce((total, table) => total + payload.data[table].length, 0) }),
  }).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "サーバー保存が未設定です。" }, { status: 501 });
  if (!isAuthenticatedAdmin(request)) return NextResponse.json({ error: "復元は管理者だけが実行できます。" }, { status: 403 });
  const backup = await request.json().catch(() => null) as Partial<BackupPayload> | null;
  if (backup?.version !== 2 || !backup.data || tables.some((table) => !Array.isArray(backup.data?.[table]))) {
    return NextResponse.json({ error: "バックアップファイルの形式が正しくありません。" }, { status: 400 });
  }
  const totalRows = tables.reduce((total, table) => total + (backup.data?.[table]?.length ?? 0), 0);
  if (totalRows > 50_000) return NextResponse.json({ error: "バックアップのデータ量が上限を超えています。" }, { status: 413 });

  if (request.nextUrl.searchParams.get("preview") === "true") {
    return NextResponse.json({ preview: true, totalRows, tables: Object.fromEntries(tables.map((table) => [table, backup.data?.[table]?.length ?? 0])) });
  }

  const ownerId = getAuthenticatedUser(request);
  await saveRecoverySnapshot(ownerId, await createBackupPayload(ownerId), "pre_restore");
  for (const table of tables) {
    const rows = rowsForOwner(table, backup.data[table], ownerId);
    if (!rows.length) continue;
    await supabaseRestRequest(`${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        Prefer: process.env.USER_DATA_OWNERSHIP_ENABLED === "true"
          ? "resolution=ignore-duplicates,return=minimal"
          : "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
  }
  return NextResponse.json({ ok: true, restoredRows: totalRows });
}
