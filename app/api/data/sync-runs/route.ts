import { NextResponse } from "next/server";
import { isSupabaseConfigured, listSyncRunsFromSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
  }

  const syncRuns = await listSyncRunsFromSupabase();
  return NextResponse.json(
    { syncRuns },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
