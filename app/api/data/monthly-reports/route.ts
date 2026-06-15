import { NextRequest, NextResponse } from "next/server";
import { createMonthlyReportInSupabase, isSupabaseConfigured, listMonthlyReportsFromSupabase } from "@/lib/supabase-admin";
import { MonthlyReport } from "@/lib/types";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const accountId = request.nextUrl.searchParams.get("accountId");
  const month = request.nextUrl.searchParams.get("month");
  const reports = await listMonthlyReportsFromSupabase(accountId, month);
  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (!body.report) return NextResponse.json({ error: "report is required." }, { status: 400 });
  const report = await createMonthlyReportInSupabase(body.report as MonthlyReport, body.accountId ?? null, body.accountName ?? "すべて");
  return NextResponse.json({ report });
}
