import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export async function GET() {
  return NextResponse.json({
    mode: isSupabaseConfigured ? "supabase" : "local",
    serverStorageEnabled: isSupabaseConfigured
  });
}
