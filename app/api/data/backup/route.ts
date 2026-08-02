import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { supabaseRestRequest } from "@/lib/supabase-server";

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
  const accounts = await supabaseRestRequest<Array<Record<string, unknown>>>(`instagram_accounts?${queryForOwner(ownerId)}`);
  const accountIds = accounts.map((account) => String(account.id));
  const entries = await Promise.all(tables.map(async (table) => {
    if (table === "instagram_accounts") return [table, accounts] as const;
    const query = ownerScopedTables.has(table) ? queryForOwner(ownerId) : queryForAccounts(accountIds);
    return [table, query ? await supabaseRestRequest<Array<Record<string, unknown>>>(`${table}?${query}`) : []] as const;
  }));
  return NextResponse.json({ version: 2, exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "サーバー保存が未設定です。" }, { status: 501 });
  const backup = await request.json().catch(() => null) as Partial<BackupPayload> | null;
  if (backup?.version !== 2 || !backup.data || tables.some((table) => !Array.isArray(backup.data?.[table]))) {
    return NextResponse.json({ error: "バックアップファイルの形式が正しくありません。" }, { status: 400 });
  }
  const totalRows = tables.reduce((total, table) => total + (backup.data?.[table]?.length ?? 0), 0);
  if (totalRows > 50_000) return NextResponse.json({ error: "バックアップのデータ量が上限を超えています。" }, { status: 413 });

  const ownerId = getAuthenticatedUser(request);
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
