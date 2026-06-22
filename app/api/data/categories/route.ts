import { NextRequest, NextResponse } from "next/server";
import { createCategoryInSupabase, deleteCategoryFromSupabase, isSupabaseConfigured, listCategoriesFromSupabase, updateCategoryInSupabase } from "@/lib/supabase-admin";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET() {
  if (!isSupabaseConfigured) return disabledResponse();
  return NextResponse.json({ categories: await listCategoriesFromSupabase() });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "カテゴリ名を入力してください。" }, { status: 400 });
  return NextResponse.json({ category: await createCategoryInSupabase(label) });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const label = String(body.label || "").trim();
  if (!body.id || !label) return NextResponse.json({ error: "カテゴリIDとカテゴリ名が必要です。" }, { status: 400 });
  return NextResponse.json({ category: await updateCategoryInSupabase(String(body.id), label) });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    await deleteCategoryFromSupabase(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "削除に失敗しました。" }, { status: 400 });
  }
}
