import { NextRequest, NextResponse } from "next/server";
import {
  createPostInSupabase,
  deletePostFromSupabase,
  isSupabaseConfigured,
  listPostsFromSupabase,
  updatePostInSupabase,
  upsertPostsInSupabase
} from "@/lib/supabase-admin";
import { InstagramPost, InstagramPostInput } from "@/lib/types";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const ownerId = getAuthenticatedUser(request);
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const requestedPageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 100);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(100, Math.max(1, Math.floor(requestedPageSize))) : 100;
  const paginationRequested = request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("pageSize");
  const accountId = request.nextUrl.searchParams.get("account_id") ?? undefined;
  const posts = await listPostsFromSupabase(ownerId, paginationRequested ? { limit: pageSize, offset: (page - 1) * pageSize, accountId } : undefined);
  if (!paginationRequested) return NextResponse.json({ posts });
  let countQuery = getSupabaseServerClient()!.from("instagram_posts").select("id", { count: "exact", head: true });
  if (process.env.USER_DATA_OWNERSHIP_ENABLED === "true") countQuery = countQuery.eq("owner_id", ownerId);
  if (accountId) countQuery = countQuery.eq("account_id", accountId);
  const { count } = await countQuery;
  return NextResponse.json({ posts, page, pageSize, total: count ?? posts.length });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const ownerId = getAuthenticatedUser(request);
  if (Array.isArray(body.posts)) {
    const posts = await upsertPostsInSupabase(body.posts as InstagramPost[], ownerId);
    return NextResponse.json({ posts });
  }
  const post = await createPostInSupabase(body.post as InstagramPostInput, ownerId);
  return NextResponse.json({ post });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const post = await updatePostInSupabase(String(body.id), body.post as InstagramPostInput, getAuthenticatedUser(request));
  return NextResponse.json({ post });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deletePostFromSupabase(id, getAuthenticatedUser(request));
  return NextResponse.json({ ok: true });
}
