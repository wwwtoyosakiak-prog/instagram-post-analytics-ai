import { NextRequest, NextResponse } from "next/server";
import { summarizeCompetitorPosts } from "@/lib/competitor-benchmark";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function request<T>(path: string, init: RequestInit = {}) {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function GET(requestObject: NextRequest) {
  const competitorId = requestObject.nextUrl.searchParams.get("competitorId");

  if (!competitorId) {
    return NextResponse.json(
      { error: "competitorIdが必要です。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<any[]>(
      `competitor_posts?select=*&competitor_id=eq.${encodeURIComponent(competitorId)}&order=posted_at.desc`,
    );

    const posts = rows.map((row) => ({
      id: row.id,
      competitorId: row.competitor_id,
      postedAt: row.posted_at,
      postType: row.post_type,
      hashtags: row.hashtags ?? "",
      likes: row.likes,
      comments: row.comments,
      views: row.views,
      saves: row.saves,
      shares: row.shares,
    }));

    return NextResponse.json({
      posts,
      summary: summarizeCompetitorPosts(competitorId, posts),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 500 },
    );
  }
}
