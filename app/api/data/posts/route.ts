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

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET() {
  if (!isSupabaseConfigured) return disabledResponse();
  const posts = await listPostsFromSupabase();
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (Array.isArray(body.posts)) {
    const posts = await upsertPostsInSupabase(body.posts as InstagramPost[]);
    return NextResponse.json({ posts });
  }
  const post = await createPostInSupabase(body.post as InstagramPostInput);
  return NextResponse.json({ post });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const post = await updatePostInSupabase(String(body.id), body.post as InstagramPostInput);
  return NextResponse.json({ post });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deletePostFromSupabase(id);
  return NextResponse.json({ ok: true });
}
