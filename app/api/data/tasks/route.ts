import { NextRequest, NextResponse } from "next/server";
import { createTaskInSupabase, deleteTaskFromSupabase, isSupabaseConfigured, listTasksFromSupabase, updateTaskInSupabase, upsertTasksInSupabase } from "@/lib/supabase-admin";
import { ImprovementTask, ImprovementTaskInput } from "@/lib/types";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const postId = request.nextUrl.searchParams.get("postId");
  const tasks = await listTasksFromSupabase(postId);
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (Array.isArray(body.tasks)) {
    const tasks = await upsertTasksInSupabase(body.tasks as ImprovementTask[]);
    return NextResponse.json({ tasks });
  }
  if (!body.task) return NextResponse.json({ error: "task is required." }, { status: 400 });
  const task = await createTaskInSupabase(body.task as ImprovementTaskInput);
  return NextResponse.json({ task });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (!body.id || !body.task) return NextResponse.json({ error: "id and task are required." }, { status: 400 });
  const task = await updateTaskInSupabase(String(body.id), body.task as ImprovementTaskInput);
  return NextResponse.json({ task });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteTaskFromSupabase(id);
  return NextResponse.json({ ok: true });
}
