import { NextRequest, NextResponse } from "next/server";
import { getLatestInsightSnapshotFromSupabase, isSupabaseConfigured } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
  }

  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId is required." }, { status: 400 });
  }

  const insight = await getLatestInsightSnapshotFromSupabase(postId);
  return NextResponse.json({ insight });
}
