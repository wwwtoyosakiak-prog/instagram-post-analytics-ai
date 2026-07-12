import { NextRequest, NextResponse } from "next/server";
import { summarizeCompetitorPosts } from "@/lib/competitor-benchmark";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PostType = "image" | "video" | "reel" | "carousel";

type CompetitorPostRow = {
  id: string;
  competitor_id: string;
  posted_at: string;
  post_type: PostType;
  caption: string | null;
  hashtags: string | null;
  likes: number;
  comments: number;
  views: number;
  saves: number | null;
  shares: number | null;
  source_url: string | null;
  created_at: string;
};

type CompetitorPostInput = {
  competitorId?: string;
  postedAt?: string;
  postType?: PostType;
  caption?: string;
  hashtags?: string;
  likes?: number;
  comments?: number;
  views?: number;
  saves?: number | null;
  shares?: number | null;
  sourceUrl?: string;
};

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

  if (!response.ok) {
    throw new Error((await response.text()) || `Supabase request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function mapPost(row: CompetitorPostRow) {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    postedAt: row.posted_at,
    postType: row.post_type,
    caption: row.caption ?? "",
    hashtags: row.hashtags ?? "",
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    views: Number(row.views ?? 0),
    saves: row.saves == null ? null : Number(row.saves),
    shares: row.shares == null ? null : Number(row.shares),
    sourceUrl: row.source_url ?? "",
    createdAt: row.created_at,
  };
}

function nonNegative(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function nullableNonNegative(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  return nonNegative(value);
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
    const rows = await request<CompetitorPostRow[]>(
      `competitor_posts?select=*&competitor_id=eq.${encodeURIComponent(competitorId)}&order=posted_at.desc`,
    );

    const posts = rows.map(mapPost);

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

export async function POST(requestObject: Request) {
  let body: CompetitorPostInput;

  try {
    body = (await requestObject.json()) as CompetitorPostInput;
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  if (!body.competitorId || !body.postedAt || !body.postType) {
    return NextResponse.json(
      { error: "競合、投稿日、投稿形式は必須です。" },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.postedAt)) {
    return NextResponse.json(
      { error: "投稿日はYYYY-MM-DD形式で入力してください。" },
      { status: 400 },
    );
  }

  try {
    const rows = await request<CompetitorPostRow[]>("competitor_posts", {
      method: "POST",
      body: JSON.stringify({
        competitor_id: body.competitorId,
        posted_at: body.postedAt,
        post_type: body.postType,
        caption: body.caption?.trim() || null,
        hashtags: body.hashtags?.trim() || null,
        likes: nonNegative(body.likes),
        comments: nonNegative(body.comments),
        views: nonNegative(body.views),
        saves: nullableNonNegative(body.saves),
        shares: nullableNonNegative(body.shares),
        source_url: body.sourceUrl?.trim() || null,
      }),
    });

    return NextResponse.json({ post: mapPost(rows[0]) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登録に失敗しました。" },
      { status: 500 },
    );
  }
}
