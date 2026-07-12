import { NextResponse } from "next/server";
import {
  buildGrowthStrategy,
  normalizeGrowthPosts,
} from "@/lib/growth-strategy";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON形式が正しくありません。" },
      { status: 400 },
    );
  }

  const source =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  const posts = normalizeGrowthPosts(source.posts);

  return NextResponse.json({
    strategy: buildGrowthStrategy(posts),
  });
}
