import { NextRequest, NextResponse } from "next/server";
import { createAnalysisInSupabase, isSupabaseConfigured, listAnalysesFromSupabase } from "@/lib/supabase-admin";
import { AiAnalysis } from "@/lib/types";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "postId is required." }, { status: 400 });
  const analyses = await listAnalysesFromSupabase(postId);
  return NextResponse.json({ analyses });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (!body.postId || !body.analysis) return NextResponse.json({ error: "postId and analysis are required." }, { status: 400 });
  const analysis = await createAnalysisInSupabase(String(body.postId), body.analysis as AiAnalysis);
  return NextResponse.json({ analysis });
}
