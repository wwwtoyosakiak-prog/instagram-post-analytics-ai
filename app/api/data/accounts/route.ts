import { NextRequest, NextResponse } from "next/server";
import {
  createAccountInSupabase,
  deleteAccountFromSupabase,
  isSupabaseConfigured,
  listAccountsFromSupabase,
  updateAccountInSupabase,
  upsertAccountsInSupabase
} from "@/lib/supabase-admin";
import { InstagramAccount, InstagramAccountInput } from "@/lib/types";

function disabledResponse() {
  return NextResponse.json({ error: "Server storage is not configured." }, { status: 501 });
}

export async function GET() {
  if (!isSupabaseConfigured) return disabledResponse();
  const accounts = await listAccountsFromSupabase();
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  if (Array.isArray(body.accounts)) {
    const accounts = await upsertAccountsInSupabase(body.accounts as InstagramAccount[]);
    return NextResponse.json({ accounts });
  }
  const account = await createAccountInSupabase(body.account as InstagramAccountInput);
  return NextResponse.json({ account });
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const body = await request.json();
  const account = await updateAccountInSupabase(String(body.id), body.account as InstagramAccountInput);
  return NextResponse.json({ account });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return disabledResponse();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await deleteAccountFromSupabase(id);
  return NextResponse.json({ ok: true });
}
