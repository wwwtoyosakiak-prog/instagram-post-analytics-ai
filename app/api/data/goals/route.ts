import { NextRequest, NextResponse } from "next/server";
import { createGoalInSupabase, deleteGoalFromSupabase, isSupabaseConfigured, listGoalsFromSupabase, updateGoalInSupabase, upsertGoalsInSupabase } from "@/lib/supabase-admin";
import { MonthlyGoal, MonthlyGoalInput } from "@/lib/types";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const accountId = request.nextUrl.searchParams.get("accountId");
  const month = request.nextUrl.searchParams.get("month");
  const goals = await listGoalsFromSupabase(accountId, month);
  return NextResponse.json({ goals });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (Array.isArray(body.goals)) {
    const goals = await upsertGoalsInSupabase(body.goals as MonthlyGoal[]);
    return NextResponse.json({ goals });
  }
  if (!body.goal) return NextResponse.json({ error: "goal is required." }, { status: 400 });
  const goal = await createGoalInSupabase(body.goal as MonthlyGoalInput);
  return NextResponse.json({ goal });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (!body.id || !body.goal) return NextResponse.json({ error: "id and goal are required." }, { status: 400 });
  const goal = await updateGoalInSupabase(String(body.id), body.goal as MonthlyGoalInput);
  return NextResponse.json({ goal });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteGoalFromSupabase(id);
  return NextResponse.json({ ok: true });
}
